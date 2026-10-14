import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  CircuitBreakerPolicy,
  CircuitBreakerOpenError,
  ConcurrencyLimiter,
  ConcurrencyLimitError,
  RateLimiterPolicy,
  RateLimitExceededError,
  PolicyPipeline,
  redactSensitiveHeaders,
  ApiClientError,
  ExampleExternalServiceAdapter,
  createApiClient,
} from '@/lib/api'

describe('Part 4.18 — API Client & Resilience Toolkit', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('1. Circuit Breaker Policy (Cockatiel Pattern)', () => {
    it('remains CLOSED and allows normal requests through when successful', async () => {
      const breaker = new CircuitBreakerPolicy({ failureThreshold: 3 })
      expect(breaker.getState()).toBe('CLOSED')

      const result = await breaker.execute(async () => 'ok')
      expect(result).toBe('ok')
      expect(breaker.getState()).toBe('CLOSED')
    })

    it('trips to OPEN after reaching failure threshold and fails fast without calling target', async () => {
      const breaker = new CircuitBreakerPolicy({
        failureThreshold: 3,
        resetTimeoutMs: 1000,
      })

      const targetFn = vi.fn().mockRejectedValue(new Error('Downstream failure'))

      // 1st failure
      await expect(breaker.execute(targetFn)).rejects.toThrow('Downstream failure')
      expect(breaker.getState()).toBe('CLOSED')

      // 2nd failure
      await expect(breaker.execute(targetFn)).rejects.toThrow('Downstream failure')
      expect(breaker.getState()).toBe('CLOSED')

      // 3rd failure: trips the circuit
      await expect(breaker.execute(targetFn)).rejects.toThrow('Downstream failure')
      expect(breaker.getState()).toBe('OPEN')

      // 4th call: fails fast with CircuitBreakerOpenError without calling targetFn!
      await expect(breaker.execute(targetFn)).rejects.toThrow(CircuitBreakerOpenError)
      expect(targetFn).toHaveBeenCalledTimes(3) // targetFn was NOT called a 4th time
    })

    it('recovers from OPEN to HALF_OPEN after reset timeout and resets to CLOSED on probe success', async () => {
      const breaker = new CircuitBreakerPolicy({
        failureThreshold: 2,
        resetTimeoutMs: 50, // short for test
      })

      // Trip to OPEN
      await expect(breaker.execute(async () => { throw new Error('fail 1') })).rejects.toThrow()
      await expect(breaker.execute(async () => { throw new Error('fail 2') })).rejects.toThrow()
      expect(breaker.getState()).toBe('OPEN')

      // Wait for reset timeout to elapse
      await new Promise((resolve) => setTimeout(resolve, 60))

      // State transitions to HALF_OPEN
      expect(breaker.getState()).toBe('HALF_OPEN')

      // Successful probe in HALF_OPEN resets breaker back to CLOSED
      const probeResult = await breaker.execute(async () => 'recovered')
      expect(probeResult).toBe('recovered')
      expect(breaker.getState()).toBe('CLOSED')
    })

    it('notifies registered state change listeners upon circuit transitions', async () => {
      const breaker = new CircuitBreakerPolicy({ failureThreshold: 1 })
      const transitions: string[] = []

      breaker.onStateChange((from, to) => {
        transitions.push(`${from}->${to}`)
      })

      await expect(breaker.execute(async () => { throw new Error('err') })).rejects.toThrow()
      expect(transitions).toContain('CLOSED->OPEN')

      breaker.reset()
      expect(transitions).toContain('OPEN->CLOSED')
    })
  })

  describe('2. Concurrency Limiter (Bulkhead Pattern)', () => {
    it('restricts active concurrent executions to configured limit', async () => {
      const limiter = new ConcurrencyLimiter({ maxConcurrent: 2, maxQueue: 5 })
      let running = 0
      let maxObservedRunning = 0

      const task = async () => {
        return limiter.execute(async () => {
          running++
          maxObservedRunning = Math.max(maxObservedRunning, running)
          await new Promise((r) => setTimeout(r, 20))
          running--
          return 'done'
        })
      }

      const tasks = [task(), task(), task(), task()]
      const results = await Promise.all(tasks)

      expect(results).toEqual(['done', 'done', 'done', 'done'])
      expect(maxObservedRunning).toBeLessThanOrEqual(2)
    })

    it('rejects executions when the queue overflows maxQueue', async () => {
      const limiter = new ConcurrencyLimiter({ maxConcurrent: 1, maxQueue: 1 })

      // Occupy the 1 concurrent slot
      const blocker = limiter.execute(() => new Promise((r) => setTimeout(r, 100)))

      // Occupy the 1 queue slot
      const queued = limiter.execute(() => Promise.resolve('ok'))

      // 3rd attempt exceeds maxQueue -> immediate ConcurrencyLimitError
      await expect(limiter.execute(() => Promise.resolve('overflow'))).rejects.toThrow(ConcurrencyLimitError)

      await Promise.all([blocker, queued])
    })
  })

  describe('3. Rate Limiter Policy & Policy Pipelines', () => {
    it('enforces token-bucket rate limits and throws RateLimitExceededError', async () => {
      const limiter = new RateLimiterPolicy({ tokensPerInterval: 2, intervalMs: 1000 })

      const res1 = await limiter.execute(async () => 'first')
      const res2 = await limiter.execute(async () => 'second')
      expect(res1).toBe('first')
      expect(res2).toBe('second')

      // 3rd request in same interval exceeds token capacity
      await expect(limiter.execute(async () => 'third')).rejects.toThrow(RateLimitExceededError)
    })

    it('composes multiple policies using PolicyPipeline', async () => {
      const breaker = new CircuitBreakerPolicy({ failureThreshold: 5 })
      const concurrency = new ConcurrencyLimiter({ maxConcurrent: 5 })
      const pipeline = new PolicyPipeline([breaker, concurrency])

      const result = await pipeline.execute(async () => 42)
      expect(result).toBe(42)
    })
  })

  describe('4. Credential Redaction & Normalized Errors', () => {
    it('redacts authorization headers, API keys, and cookies from headers', () => {
      const headers = {
        'Authorization': 'Bearer super-secret-jwt-token',
        'X-Api-Key': 'secret-provider-key-999',
        'Cookie': 'session_token=xyz123',
        'Content-Type': 'application/json',
        'User-Agent': 'HackathonStarter/1.0',
      }

      const redacted = redactSensitiveHeaders(headers)
      expect(redacted['authorization']).toBe('[REDACTED]')
      expect(redacted['x-api-key']).toBe('[REDACTED]')
      expect(redacted['cookie']).toBe('[REDACTED]')
      expect(redacted['content-type']).toBe('application/json')
      expect(redacted['user-agent']).toBe('HackathonStarter/1.0')
    })

    it('normalizes error properties on ApiClientError', () => {
      const err = new ApiClientError('Request failed due to timeout', {
        status: 504,
        code: 'TIMEOUT',
        requestId: 'req_123',
      })

      expect(err.name).toBe('ApiClientError')
      expect(err.status).toBe(504)
      expect(err.code).toBe('TIMEOUT')
      expect(err.requestId).toBe('req_123')
      expect(err.isTimeout).toBe(true)
      expect(err.isNetworkError).toBe(false)
    })

    it('creates configured API client instances with custom baseUrl and headers', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ score: 100 }),
      })

      const client = createApiClient({
        baseUrl: 'https://api.custom.dev/v2',
        defaultHeaders: { 'x-app-name': 'hackathon' },
      })

      const res = await client.get<{ score: number }>('/metrics')
      expect(res.ok).toBe(true)
      expect(res.data?.score).toBe(100)

      const fetchCall = vi.mocked(global.fetch).mock.calls[0]
      expect(fetchCall[0]).toBe('https://api.custom.dev/v2/metrics')
    })
  })

  describe('5. Provider Adapter Pattern & Integration', () => {
    it('handles offline state gracefully when credentials are not configured', async () => {
      const adapter = new ExampleExternalServiceAdapter({ apiKey: undefined })
      const status = await adapter.getStatus()

      expect(status.connected).toBe(false)
      expect(status.statusText).toContain('Offline: API key not configured')
    })

    it('connects and passes provider authorization headers when key is configured', async () => {
      const adapter = new ExampleExternalServiceAdapter({
        apiKey: 'test-valid-key',
        baseUrl: 'https://api.external.dev',
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ status: 'Operational' }),
      })

      const status = await adapter.getStatus()
      expect(status.connected).toBe(true)
      expect(status.statusText).toBe('Operational')

      // Verify authorization header was passed
      const fetchCall = vi.mocked(global.fetch).mock.calls[0]
      const requestHeaders = fetchCall[1]?.headers
      const authHeader =
        requestHeaders instanceof Headers
          ? requestHeaders.get('authorization')
          : (requestHeaders as Record<string, string> | undefined)?.['authorization']
      expect(authHeader).toBe('Bearer test-valid-key')
    })

    it('normalizes external provider error codes cleanly into user-friendly messages', async () => {
      const adapter = new ExampleExternalServiceAdapter({
        apiKey: 'bad-key',
        baseUrl: 'https://api.external.dev',
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers(),
        text: async () => '{"error": "Invalid token"}',
      })

      const status = await adapter.getStatus()
      expect(status.connected).toBe(false)
      expect(status.statusText).toContain('Authentication failed')
    })
  })
})
