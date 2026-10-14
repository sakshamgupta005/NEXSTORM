/**
 * Reusable API Client & Resilience Toolkit — Type Definitions
 */

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit (default: 5) */
  failureThreshold?: number
  /** Time window in ms during which failures are tracked (default: 30,000ms) */
  samplingDurationMs?: number
  /** Time in ms before an open circuit transitions to half-open to probe health (default: 15,000ms) */
  resetTimeoutMs?: number
  /** Optional filter: return true if the error should count as a failure */
  isFailure?: (error: unknown) => boolean
}

export interface ConcurrencyLimiterConfig {
  /** Maximum number of concurrent executions permitted (default: 10) */
  maxConcurrent?: number
  /** Maximum number of pending executions queued (default: 50) */
  maxQueue?: number
}

export interface RateLimiterConfig {
  /** Maximum number of requests allowed per window (default: 10) */
  tokensPerInterval: number
  /** Interval in milliseconds (default: 1000ms) */
  intervalMs: number
}

export interface ApiTelemetryEvent {
  requestId: string
  url: string
  method: string
  durationMs: number
  status?: number
  attempts: number
  success: boolean
  errorCode?: string
  errorMessage?: string
}

export interface ApiClientHooks {
  onRequestStart?: (req: { requestId: string; url: string; method: string }) => void
  onRequestSuccess?: (event: ApiTelemetryEvent) => void
  onRequestError?: (event: ApiTelemetryEvent) => void
  onRetry?: (retryInfo: { requestId: string; attempt: number; delayMs: number; error: string }) => void
  onCircuitStateChange?: (change: { from: CircuitBreakerState; to: CircuitBreakerState; serviceName?: string }) => void
}

export interface ResiliencePolicy {
  name: string
  execute: <T>(fn: () => Promise<T>) => Promise<T>
}
