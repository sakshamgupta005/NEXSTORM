import { safeFetch, type SafeFetchOptions, type SafeFetchResult } from './client'
import { CircuitBreakerPolicy, ConcurrencyLimiter } from './resilience'
import type { ApiClientHooks } from './types'

export interface ApiAdapterConfig {
  baseUrl: string
  apiKey?: string
  timeoutMs?: number
  retries?: number
  useCircuitBreaker?: boolean
  hooks?: ApiClientHooks
}

/**
 * Base Provider Adapter
 * 
 * Provides standard authentication injection, resilience policy wrapping,
 * custom error normalization, and offline mock support without coupling domain logic to providers.
 */
export abstract class BaseApiAdapter {
  protected readonly baseUrl: string
  protected readonly apiKey?: string
  protected readonly timeoutMs: number
  protected readonly retries: number
  protected readonly circuitBreaker?: CircuitBreakerPolicy
  protected readonly concurrencyLimiter?: ConcurrencyLimiter
  protected readonly hooks?: ApiClientHooks

  constructor(config: ApiAdapterConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.apiKey = config.apiKey
    this.timeoutMs = config.timeoutMs ?? 10000
    this.retries = config.retries ?? 2
    this.hooks = config.hooks

    if (config.useCircuitBreaker) {
      this.circuitBreaker = new CircuitBreakerPolicy({
        failureThreshold: 3,
        resetTimeoutMs: 10000,
      })
      if (this.hooks?.onCircuitStateChange) {
        this.circuitBreaker.onStateChange((from, to) => {
          this.hooks?.onCircuitStateChange?.({
            from,
            to,
            serviceName: this.constructor.name,
          })
        })
      }
    }
  }

  /**
   * Provides headers required by the specific external provider
   */
  protected abstract getProviderHeaders(): Record<string, string>

  /**
   * Normalizes provider-specific error responses into domain messages
   */
  protected abstract normalizeError(status: number, rawError?: string): string

  /**
   * Execute an HTTP request with provider headers and resilience policies
   */
  protected async request<T = unknown>(
    endpoint: string,
    options: Omit<SafeFetchOptions, 'baseUrl'> = {}
  ): Promise<SafeFetchResult<T>> {
    const executeCall = async (): Promise<SafeFetchResult<T>> => {
      const mergedHeaders = {
        ...this.getProviderHeaders(),
        ...(options.headers as Record<string, string> | undefined),
      }

      const res = await safeFetch<T>(`${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`, {
        ...options,
        timeoutMs: options.timeoutMs ?? this.timeoutMs,
        retries: options.retries ?? this.retries,
        headers: mergedHeaders,
      })

      if (!res.ok) {
        return {
          ...res,
          error: this.normalizeError(res.status, res.error),
        }
      }

      return res
    }

    if (this.circuitBreaker) {
      try {
        return await this.circuitBreaker.execute(executeCall)
      } catch (err: unknown) {
        return {
          ok: false,
          status: 503,
          error: err instanceof Error ? err.message : String(err),
          errorCode: 'HTTP_ERROR',
          requestId: `err_${Date.now()}`,
          attempts: 0,
        }
      }
    }

    return executeCall()
  }
}

/**
 * Example External Service Adapter (Demonstrating Provider Integration)
 */
export class ExampleExternalServiceAdapter extends BaseApiAdapter {
  constructor(config: { apiKey?: string; baseUrl?: string; isMock?: boolean } = {}) {
    super({
      baseUrl: config.baseUrl || 'https://api.external-provider.dev/v1',
      apiKey: config.apiKey,
      timeoutMs: 8000,
      retries: 2,
      useCircuitBreaker: true,
    })
  }

  protected getProviderHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'accept': 'application/json',
      'user-agent': 'Hackathon-Starter/1.0',
    }
    if (this.apiKey) {
      headers['authorization'] = `Bearer ${this.apiKey}`
    }
    return headers
  }

  protected normalizeError(status: number, rawError?: string): string {
    if (status === 401) return 'Authentication failed: Invalid or missing API key.'
    if (status === 429) return 'Provider rate limit exceeded. Please retry shortly.'
    if (status >= 500) return 'External provider is temporarily unavailable.'
    return rawError || `Provider request failed with HTTP ${status}`
  }

  public async getStatus(): Promise<{ connected: boolean; statusText: string }> {
    if (!this.apiKey) {
      // Graceful offline behavior when credentials are omitted
      return { connected: false, statusText: 'Offline: API key not configured' }
    }

    const res = await this.request<{ status: string }>('/health', {
      method: 'GET',
    })

    if (!res.ok) {
      return { connected: false, statusText: res.error || 'Connection failed' }
    }

    return { connected: true, statusText: res.data?.status || 'Healthy' }
  }
}
