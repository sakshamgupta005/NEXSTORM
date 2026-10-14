import type {
  CircuitBreakerConfig,
  CircuitBreakerState,
  ConcurrencyLimiterConfig,
  RateLimiterConfig,
  ResiliencePolicy,
} from './types'

export class CircuitBreakerOpenError extends Error {
  constructor(message = 'Circuit breaker is OPEN. Requests are temporarily blocked to protect downstream services.') {
    super(message)
    this.name = 'CircuitBreakerOpenError'
  }
}

export class ConcurrencyLimitError extends Error {
  constructor(message = 'Concurrency limit reached. Request rejected to prevent connection exhaustion.') {
    super(message)
    this.name = 'ConcurrencyLimitError'
  }
}

export class RateLimitExceededError extends Error {
  constructor(message = 'Client rate limit exceeded. Please throttle request rate.') {
    super(message)
    this.name = 'RateLimitExceededError'
  }
}

/**
 * Circuit Breaker Pattern (Cockatiel-inspired state machine)
 * 
 * States:
 * - CLOSED: Normal operation. Requests flow through. Failures are tracked.
 * - OPEN: Downstream is failing. Requests immediately fail-fast without network traffic.
 * - HALF_OPEN: Trial period. Allows a single request through to test if service has recovered.
 */
export class CircuitBreakerPolicy implements ResiliencePolicy {
  public readonly name = 'circuit-breaker'
  private state: CircuitBreakerState = 'CLOSED'
  private consecutiveFailures = 0
  private lastStateChange: number = Date.now()
  private stateListeners: Array<(from: CircuitBreakerState, to: CircuitBreakerState) => void> = []

  private readonly failureThreshold: number
  private readonly resetTimeoutMs: number
  private readonly isFailure: (err: unknown) => boolean

  constructor(config: CircuitBreakerConfig = {}) {
    this.failureThreshold = config.failureThreshold ?? 5
    this.resetTimeoutMs = config.resetTimeoutMs ?? 15000
    this.isFailure = config.isFailure ?? (() => true)
  }

  public onStateChange(listener: (from: CircuitBreakerState, to: CircuitBreakerState) => void): () => void {
    this.stateListeners.push(listener)
    return () => {
      this.stateListeners = this.stateListeners.filter((l) => l !== listener)
    }
  }

  private transitionTo(newState: CircuitBreakerState): void {
    if (this.state === newState) return
    const oldState = this.state
    this.state = newState
    this.lastStateChange = Date.now()

    for (const listener of this.stateListeners) {
      try {
        listener(oldState, newState)
      } catch {
        // Safe listener execution
      }
    }
  }

  public getState(): CircuitBreakerState {
    // If OPEN and reset timeout has elapsed, transition to HALF_OPEN
    if (this.state === 'OPEN' && Date.now() - this.lastStateChange >= this.resetTimeoutMs) {
      this.transitionTo('HALF_OPEN')
    }
    return this.state
  }

  public reset(): void {
    this.consecutiveFailures = 0
    this.transitionTo('CLOSED')
  }

  public trip(): void {
    this.consecutiveFailures = this.failureThreshold
    this.transitionTo('OPEN')
  }

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState()

    if (currentState === 'OPEN') {
      throw new CircuitBreakerOpenError()
    }

    try {
      const result = await fn()
      // If we succeed in HALF_OPEN, service has recovered!
      if (this.state === 'HALF_OPEN') {
        this.reset()
      } else {
        this.consecutiveFailures = 0
      }
      return result
    } catch (err: unknown) {
      if (this.isFailure(err)) {
        this.consecutiveFailures++
        if (this.state === 'HALF_OPEN' || this.consecutiveFailures >= this.failureThreshold) {
          this.transitionTo('OPEN')
        }
      }
      throw err
    }
  }
}

/**
 * Concurrency Limiter (Bulkhead Pattern)
 * 
 * Restricts simultaneous active operations to prevent socket or resource exhaustion.
 */
export class ConcurrencyLimiter implements ResiliencePolicy {
  public readonly name = 'concurrency-limiter'
  private activeCount = 0
  private queue: Array<() => void> = []

  private readonly maxConcurrent: number
  private readonly maxQueue: number

  constructor(config: ConcurrencyLimiterConfig = {}) {
    this.maxConcurrent = config.maxConcurrent ?? 10
    this.maxQueue = config.maxQueue ?? 50
  }

  public getInFlightCount(): number {
    return this.activeCount
  }

  public getQueueLength(): number {
    return this.queue.length
  }

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount++
      try {
        return await fn()
      } finally {
        this.activeCount--
        this.dequeueNext()
      }
    }

    if (this.queue.length >= this.maxQueue) {
      throw new ConcurrencyLimitError()
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        this.activeCount++
        try {
          const res = await fn()
          resolve(res)
        } catch (err) {
          reject(err)
        } finally {
          this.activeCount--
          this.dequeueNext()
        }
      })
    })
  }

  private dequeueNext(): void {
    if (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
      const nextFn = this.queue.shift()
      if (nextFn) nextFn()
    }
  }
}

/**
 * Token-Bucket Rate Limiter Policy
 */
export class RateLimiterPolicy implements ResiliencePolicy {
  public readonly name = 'rate-limiter'
  private tokens: number
  private lastRefill: number = Date.now()

  private readonly tokensPerInterval: number
  private readonly intervalMs: number

  constructor(config: RateLimiterConfig) {
    this.tokensPerInterval = config.tokensPerInterval
    this.intervalMs = config.intervalMs
    this.tokens = config.tokensPerInterval
  }

  private refill(): void {
    const now = Date.now()
    const elapsed = now - this.lastRefill
    if (elapsed >= this.intervalMs) {
      const intervalsElapsed = Math.floor(elapsed / this.intervalMs)
      this.tokens = Math.min(this.tokensPerInterval, this.tokens + intervalsElapsed * this.tokensPerInterval)
      this.lastRefill = now
    }
  }

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.refill()
    if (this.tokens <= 0) {
      throw new RateLimitExceededError()
    }
    this.tokens--
    return fn()
  }
}

/**
 * Composable Resilience Policy Pipeline
 */
export class PolicyPipeline implements ResiliencePolicy {
  public readonly name = 'pipeline'
  private policies: ResiliencePolicy[]

  constructor(policies: ResiliencePolicy[] = []) {
    this.policies = policies
  }

  public add(policy: ResiliencePolicy): this {
    this.policies.push(policy)
    return this
  }

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    let currentFn = fn
    // Wrap from inside out so first added policy executes outermost
    for (let i = this.policies.length - 1; i >= 0; i--) {
      const policy = this.policies[i]
      const wrapped = currentFn
      currentFn = () => policy.execute(wrapped)
    }
    return currentFn()
  }
}
