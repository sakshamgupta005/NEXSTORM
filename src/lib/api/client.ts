/**
 * Resilient & Configurable API Client Helper
 * 
 * Capabilities:
 * - Configurable Base URL & query parameters
 * - Typed request (json, headers, auth) & response handling (json, text, blob, formData, arrayBuffer)
 * - Safe retries with exponential backoff & jitter on 5xx, 429, or network errors
 * - Idempotency guard: NEVER blindly retries non-idempotent methods (POST, PATCH)
 *   unless explicitly marked with `idempotent: true`
 * - In-flight request deduplication for concurrent identical GET requests
 * - Request ID tagging for distributed tracing (`x-request-id`)
 * - Request cancellation combining user AbortSignal with request timeouts
 * - Structured error classification (HTTP_ERROR, TIMEOUT, ABORTED, NETWORK_ERROR, PARSE_ERROR, VALIDATION_ERROR)
 * - Token management with secure headers without leaking credentials into logs
 * - Optional Zod schema response validation
 */

import { z } from 'zod'
import type { ApiClientHooks } from './types'

export type ApiErrorCode =
  | 'HTTP_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'ABORTED'
  | 'PARSE_ERROR'
  | 'VALIDATION_ERROR'
  | 'CIRCUIT_OPEN'
  | 'UNKNOWN'

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'x-api-key',
  'cookie',
  'set-cookie',
  'proxy-authorization',
])

/**
 * Redacts authorization tokens, cookies, and api keys from logged or reported headers
 */
export function redactSensitiveHeaders(headers?: HeadersInit): Record<string, string> {
  const result: Record<string, string> = {}
  if (!headers) return result

  if (headers instanceof Headers) {
    headers.forEach((val, key) => {
      result[key.toLowerCase()] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? '[REDACTED]' : val
    })
  } else if (Array.isArray(headers)) {
    for (const [key, val] of headers) {
      result[key.toLowerCase()] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? '[REDACTED]' : val
    }
  } else {
    for (const [key, val] of Object.entries(headers)) {
      result[key.toLowerCase()] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? '[REDACTED]' : String(val)
    }
  }

  return result
}

/**
 * Normalized API Client Error
 */
export class ApiClientError extends Error {
  public readonly status: number
  public readonly code: ApiErrorCode
  public readonly requestId: string
  public readonly retryAfter?: number
  public readonly isTimeout: boolean
  public readonly isNetworkError: boolean

  constructor(
    message: string,
    options: { status?: number; code?: ApiErrorCode; requestId?: string; retryAfter?: number } = {}
  ) {
    super(message)
    this.name = 'ApiClientError'
    this.status = options.status || 0
    this.code = options.code || 'UNKNOWN'
    this.requestId = options.requestId || ''
    this.retryAfter = options.retryAfter
    this.isTimeout = this.code === 'TIMEOUT'
    this.isNetworkError = this.code === 'NETWORK_ERROR'
  }
}

export interface SafeFetchOptions extends RequestInit {
  baseUrl?: string
  params?: Record<string, string | number | boolean | undefined | null>
  json?: unknown
  responseType?: 'json' | 'text' | 'blob' | 'formData' | 'arrayBuffer'
  timeoutMs?: number
  retries?: number
  retryDelayMs?: number
  requestId?: string
  schema?: z.ZodTypeAny
  /** Set to true to allow retries on non-idempotent methods (POST, PATCH) */
  idempotent?: boolean
  getAuthToken?: () => string | Promise<string | null>
  authToken?: string
  deduplicate?: boolean
  debug?: boolean
  hooks?: ApiClientHooks
}

export interface SafeFetchResult<T = unknown> {
  ok: boolean
  status: number
  data?: T
  error?: string
  errorCode?: ApiErrorCode
  retryAfter?: number
  headers?: Headers
  requestId: string
  attempts: number
}

export interface ApiClientConfig {
  baseUrl?: string
  defaultHeaders?: HeadersInit
  getAuthToken?: () => string | Promise<string | null>
  timeoutMs?: number
  retries?: number
  retryDelayMs?: number
  debug?: boolean
  hooks?: ApiClientHooks
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'])

/**
 * In-flight GET request deduplication cache
 */
const inFlightRequests = new Map<string, Promise<SafeFetchResult<unknown>>>()

export function buildUrl(
  url: string,
  baseUrl?: string,
  params?: Record<string, string | number | boolean | undefined | null>
): string {
  let fullUrl = url
  if (baseUrl && !/^https?:\/\//i.test(url)) {
    const trimmedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
    const trimmedUrl = url.startsWith('/') ? url : `/${url}`
    fullUrl = `${trimmedBase}${trimmedUrl}`
  }

  if (params && Object.keys(params).length > 0) {
    const [pathPart, queryPart] = fullUrl.split('?')
    const searchParams = new URLSearchParams(queryPart || '')
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null) {
        searchParams.set(key, String(val))
      }
    }
    const queryString = searchParams.toString()
    fullUrl = queryString ? `${pathPart}?${queryString}` : pathPart
  }

  return fullUrl
}

function combineSignals(
  userSignal?: AbortSignal | null,
  timeoutSignal?: AbortSignal | null
): { signal: AbortSignal; cleanup: () => void } {
  if (!userSignal && !timeoutSignal) {
    const controller = new AbortController()
    return { signal: controller.signal, cleanup: () => {} }
  }
  if (!userSignal) return { signal: timeoutSignal!, cleanup: () => {} }
  if (!timeoutSignal) return { signal: userSignal, cleanup: () => {} }

  const controller = new AbortController()
  const onAbort = () => controller.abort()

  if (userSignal.aborted || timeoutSignal.aborted) {
    controller.abort()
    return { signal: controller.signal, cleanup: () => {} }
  }

  userSignal.addEventListener('abort', onAbort)
  timeoutSignal.addEventListener('abort', onAbort)

  const cleanup = () => {
    userSignal.removeEventListener('abort', onAbort)
    timeoutSignal.removeEventListener('abort', onAbort)
  }

  return { signal: controller.signal, cleanup }
}

export async function safeFetch<T = unknown>(
  url: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult<T>> {
  const {
    baseUrl,
    params,
    json,
    responseType = 'json',
    timeoutMs = 10000,
    retries = 1,
    retryDelayMs = 250,
    requestId = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `req_${Date.now()}`),
    schema,
    idempotent,
    getAuthToken,
    authToken,
    deduplicate = false,
    headers = {},
    method = 'GET',
    signal: userSignal,
    ...fetchInit
  } = options

  const fullUrl = buildUrl(url, baseUrl, params)
  const upperMethod = method.toUpperCase()
  const isMethodIdempotent = idempotent !== undefined ? idempotent : IDEMPOTENT_METHODS.has(upperMethod)

  // In-flight deduplication for identical GET requests
  if (deduplicate && upperMethod === 'GET') {
    const dedupeKey = `GET::${fullUrl}`
    const existing = inFlightRequests.get(dedupeKey)
    if (existing) {
      return existing as Promise<SafeFetchResult<T>>
    }
    const executePromise = executeSafeFetch<T>()
    inFlightRequests.set(dedupeKey, executePromise)
    try {
      return await executePromise
    } finally {
      inFlightRequests.delete(dedupeKey)
    }
  }

  return executeSafeFetch<T>()

  async function executeSafeFetch<TResult>(): Promise<SafeFetchResult<TResult>> {
    const reqHeaders = new Headers(headers)
    if (!reqHeaders.has('x-request-id')) {
      reqHeaders.set('x-request-id', requestId)
    }

    // Dynamic Auth Token resolution
    let resolvedToken = authToken
    if (!resolvedToken && getAuthToken) {
      try {
        const token = await getAuthToken()
        if (token) resolvedToken = token
      } catch {
        // fail-safe: proceed without token
      }
    }
    if (resolvedToken && !reqHeaders.has('authorization')) {
      reqHeaders.set('authorization', `Bearer ${resolvedToken}`)
    }

    // JSON body helper
    let bodyPayload = fetchInit.body
    if (json !== undefined) {
      if (!reqHeaders.has('content-type')) {
        reqHeaders.set('content-type', 'application/json')
      }
      bodyPayload = JSON.stringify(json)
    }

    let attempts = 0
    let lastError = 'Unknown request failure'
    let lastErrorCode: ApiErrorCode = 'UNKNOWN'
    let lastStatus = 0
    let lastHeaders: Headers | undefined
    let lastRetryAfter: number | undefined

    while (attempts <= retries) {
      attempts++
      const timeoutController = new AbortController()
      const timer = setTimeout(() => timeoutController.abort(), timeoutMs)
      const { signal: combinedSignal, cleanup: cleanupSignals } = combineSignals(userSignal, timeoutController.signal)

      try {
        const response = await fetch(fullUrl, {
          ...fetchInit,
          body: bodyPayload,
          method: upperMethod,
          headers: reqHeaders,
          signal: combinedSignal,
        })
        clearTimeout(timer)
        cleanupSignals()

        lastStatus = response.status
        lastHeaders = response.headers

        // Parse Retry-After if 429
        if (response.status === 429) {
          const retryHeader = response.headers.get('retry-after')
          if (retryHeader) {
            const seconds = parseInt(retryHeader, 10)
            if (!isNaN(seconds)) lastRetryAfter = seconds
          }
        }

        // Handle HTTP errors
        if (!response.ok) {
          lastErrorCode = 'HTTP_ERROR'
          let errDetail = `HTTP ${response.status} ${response.statusText}`
          try {
            const body = await response.text()
            if (body) {
              errDetail = body.length > 250 ? `${body.slice(0, 250)}...` : body
            }
          } catch {
            // ignore body reading error
          }

          const isUpstreamError = response.status === 429 || response.status >= 500
          const shouldRetry = isUpstreamError && isMethodIdempotent && attempts <= retries

          if (!shouldRetry) {
            return {
              ok: false,
              status: response.status,
              error: errDetail,
              errorCode: 'HTTP_ERROR',
              retryAfter: lastRetryAfter,
              headers: response.headers,
              requestId,
              attempts,
            }
          }

          // Exponential backoff with jitter
          const backoff = retryDelayMs * Math.pow(2, attempts - 1)
          const jitter = backoff * (0.8 + Math.random() * 0.4)
          await wait(jitter)
          continue
        }

        // 2xx Success: Parse according to requested responseType
        let parsedData: unknown
        try {
          if (responseType === 'blob') {
            parsedData = await response.blob()
          } else if (responseType === 'formData') {
            parsedData = await response.formData()
          } else if (responseType === 'arrayBuffer') {
            parsedData = await response.arrayBuffer()
          } else if (responseType === 'text') {
            parsedData = await response.text()
          } else {
            // Default: check content-type or parse json
            const contentType = response.headers.get('content-type') || ''
            if (contentType.includes('application/json')) {
              parsedData = await response.json()
            } else {
              parsedData = await response.text()
            }
          }
        } catch (parseErr: unknown) {
          return {
            ok: false,
            status: response.status,
            error: `Failed to parse response as ${responseType}: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
            errorCode: 'PARSE_ERROR',
            headers: response.headers,
            requestId,
            attempts,
          }
        }

        // Optional Zod Schema validation
        if (schema) {
          const validation = schema.safeParse(parsedData)
          if (!validation.success) {
            return {
              ok: false,
              status: response.status,
              error: `Schema validation failed: ${validation.error.issues.map((i) => i.message).join(', ')}`,
              errorCode: 'VALIDATION_ERROR',
              headers: response.headers,
              requestId,
              attempts,
            }
          }
          parsedData = validation.data
        }

        return {
          ok: true,
          status: response.status,
          data: parsedData as TResult,
          headers: response.headers,
          requestId,
          attempts,
        }
      } catch (err: unknown) {
        clearTimeout(timer)
        cleanupSignals()

        if (err instanceof Error && err.name === 'AbortError') {
          if (userSignal?.aborted) {
            lastError = 'Request was cancelled by user'
            lastErrorCode = 'ABORTED'
          } else {
            lastError = `Request timed out after ${timeoutMs}ms`
            lastErrorCode = 'TIMEOUT'
          }
        } else if (err instanceof Error) {
          lastError = err.message
          lastErrorCode = 'NETWORK_ERROR'
        } else {
          lastError = String(err)
          lastErrorCode = 'NETWORK_ERROR'
        }

        // If user explicitly cancelled, do not retry
        if (lastErrorCode === 'ABORTED') {
          return {
            ok: false,
            status: 0,
            error: lastError,
            errorCode: 'ABORTED',
            requestId,
            attempts,
          }
        }

        const shouldRetry = isMethodIdempotent && attempts <= retries
        if (!shouldRetry) {
          return {
            ok: false,
            status: lastStatus || 0,
            error: lastError,
            errorCode: lastErrorCode,
            headers: lastHeaders,
            requestId,
            attempts,
          }
        }

        const backoff = retryDelayMs * Math.pow(2, attempts - 1)
        const jitter = backoff * (0.8 + Math.random() * 0.4)
        await wait(jitter)
      }
    }

    return {
      ok: false,
      status: lastStatus,
      error: lastError,
      errorCode: lastErrorCode,
      headers: lastHeaders,
      retryAfter: lastRetryAfter,
      requestId,
      attempts,
    }
  }
}

/**
 * Factory for creating configured API client instances
 */
export function createApiClient(config: ApiClientConfig = {}) {
  const mergedConfig: SafeFetchOptions = {
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
    retries: config.retries,
    retryDelayMs: config.retryDelayMs,
    getAuthToken: config.getAuthToken,
    debug: config.debug,
    headers: config.defaultHeaders,
    hooks: config.hooks,
  }

  return {
    fetch: <T>(url: string, options?: SafeFetchOptions) =>
      safeFetch<T>(url, { ...mergedConfig, ...options, headers: { ...mergedConfig.headers, ...options?.headers } }),
    get: <T>(url: string, options?: Omit<SafeFetchOptions, 'method'>) =>
      safeFetch<T>(url, { ...mergedConfig, ...options, method: 'GET', headers: { ...mergedConfig.headers, ...options?.headers } }),
    post: <T>(url: string, data?: unknown, options?: Omit<SafeFetchOptions, 'method' | 'json'>) =>
      safeFetch<T>(url, { ...mergedConfig, ...options, method: 'POST', json: data, headers: { ...mergedConfig.headers, ...options?.headers } }),
    put: <T>(url: string, data?: unknown, options?: Omit<SafeFetchOptions, 'method' | 'json'>) =>
      safeFetch<T>(url, { ...mergedConfig, ...options, method: 'PUT', json: data, headers: { ...mergedConfig.headers, ...options?.headers } }),
    patch: <T>(url: string, data?: unknown, options?: Omit<SafeFetchOptions, 'method' | 'json'>) =>
      safeFetch<T>(url, { ...mergedConfig, ...options, method: 'PATCH', json: data, headers: { ...mergedConfig.headers, ...options?.headers } }),
    delete: <T>(url: string, options?: Omit<SafeFetchOptions, 'method'>) =>
      safeFetch<T>(url, { ...mergedConfig, ...options, method: 'DELETE', headers: { ...mergedConfig.headers, ...options?.headers } }),
  }
}

export const apiClient = createApiClient()
