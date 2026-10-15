/**
 * Standardized API Response and Error Handlers
 * 
 * Capabilities:
 * - Uniform JSON contract across all Route Handlers
 * - Never leaks raw database errors, stack traces, or credentials in production
 * - Attaches request ID and timestamp to all responses
 * - Standard HTTP error codes (400, 401, 403, 404, 429, 500, 502, 503, 504)
 */

import { NextResponse } from 'next/server'
import { logger } from '@/lib/logging/logger'

export interface ApiSuccessPayload<T> {
  success: true
  data: T
  requestId: string
  timestamp: string
}

export interface ApiErrorPayload {
  success: false
  error: {
    message: string
    code: string
    details?: unknown
  }
  requestId: string
  timestamp: string
}

export interface ApiSuccessOptions {
  status?: number
  headers?: HeadersInit
  requestId?: string
}

export interface ApiErrorOptions {
  status?: number
  code?: string
  details?: unknown
  headers?: HeadersInit
  requestId?: string
  internalError?: unknown
}

function resolveRequestId(explicit?: string): string {
  if (explicit) return explicit
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `req_${Date.now()}`
}

const DEFAULT_ERROR_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT',
}

/**
 * Creates a standardized JSON success response.
 */
export function apiSuccess<T>(data: T, options: ApiSuccessOptions = {}): NextResponse<ApiSuccessPayload<T>> {
  const { status = 200, headers = {}, requestId: rawRequestId } = options
  const requestId = resolveRequestId(rawRequestId)

  const payload: ApiSuccessPayload<T> = {
    success: true,
    data,
    requestId,
    timestamp: new Date().toISOString(),
  }

  const resHeaders = new Headers(headers)
  if (!resHeaders.has('x-request-id')) {
    resHeaders.set('x-request-id', requestId)
  }

  return NextResponse.json(payload, { status, headers: resHeaders })
}

/**
 * Creates a standardized JSON error response.
 * Strips raw internal exceptions in production.
 */
export function apiError(message: string, options: ApiErrorOptions = {}): NextResponse<ApiErrorPayload> {
  const {
    status = 500,
    code = DEFAULT_ERROR_CODES[status] || 'ERROR',
    details,
    headers = {},
    requestId: rawRequestId,
    internalError,
  } = options

  const requestId = resolveRequestId(rawRequestId)

  // Log internal error server-side without exposing to user
  if (internalError) {
    logger.error(`API Error [${code}]: ${message}`, { requestId, status, code }, internalError)
  } else if (status >= 500) {
    logger.error(`API Error [${code}]: ${message}`, { requestId, status, code })
  }

  // Sanitize message in production for 5xx errors to prevent leaking database or server internals
  let clientMessage = message
  if (status >= 500 && process.env.NODE_ENV === 'production') {
    clientMessage = 'An unexpected server error occurred. Please try again later.'
  }

  const payload: ApiErrorPayload = {
    success: false,
    error: {
      message: clientMessage,
      code,
      ...(details !== undefined && { details }),
    },
    requestId,
    timestamp: new Date().toISOString(),
  }

  const resHeaders = new Headers(headers)
  if (!resHeaders.has('x-request-id')) {
    resHeaders.set('x-request-id', requestId)
  }

  return NextResponse.json(payload, { status, headers: resHeaders })
}

/**
 * Detects Next.js dynamic server usage / prerendering bail-out errors.
 * These must be re-thrown so Next.js handles route lifecycle correctly.
 */
export function isDynamicServerError(err: unknown): boolean {
  if (err instanceof Error) {
    if (err.message.includes('bail out of prerendering')) return true
    if ((err as { digest?: string }).digest?.startsWith('DYNAMIC_SERVER_USAGE')) return true
  }
  return false
}

/**
 * Standard catch handler for API Route Handlers.
 * Automatically rethrows Next.js dynamic bail-out errors and formats 500 responses.
 */
export function handleApiCatch(
  err: unknown,
  fallbackMessage: string,
  options?: Omit<ApiErrorOptions, 'internalError'>
): NextResponse<ApiErrorPayload> {
  if (isDynamicServerError(err)) {
    throw err
  }
  const message = err instanceof Error ? err.message : fallbackMessage
  return apiError(message, {
    status: 500,
    ...options,
    internalError: err,
  })
}
