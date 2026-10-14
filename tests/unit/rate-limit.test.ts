import { describe, it, expect, beforeEach } from 'vitest'
import { checkRateLimit, rateLimiter, getClientIp } from '@/lib/security/rate-limit'

describe('In-Memory Rate Limiter', () => {
  const clientId = 'test-client-123'

  beforeEach(() => {
    rateLimiter.reset(clientId)
  })

  it('allows requests within limit and decrements remaining', () => {
    const res1 = checkRateLimit(clientId, { limit: 3, windowMs: 10000 })
    expect(res1.success).toBe(true)
    expect(res1.remaining).toBe(2)
    expect(res1.headers['X-RateLimit-Limit']).toBe('3')
    expect(res1.headers['X-RateLimit-Remaining']).toBe('2')

    const res2 = checkRateLimit(clientId, { limit: 3, windowMs: 10000 })
    expect(res2.success).toBe(true)
    expect(res2.remaining).toBe(1)

    const res3 = checkRateLimit(clientId, { limit: 3, windowMs: 10000 })
    expect(res3.success).toBe(true)
    expect(res3.remaining).toBe(0)
  })

  it('rejects requests when limit is exceeded and returns Retry-After', () => {
    checkRateLimit(clientId, { limit: 2, windowMs: 10000 })
    checkRateLimit(clientId, { limit: 2, windowMs: 10000 })

    const blocked = checkRateLimit(clientId, { limit: 2, windowMs: 10000 })
    expect(blocked.success).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.headers['Retry-After']).toBeDefined()
    expect(Number(blocked.headers['Retry-After'])).toBeGreaterThan(0)
  })

  it('resets correctly after reset is called', () => {
    checkRateLimit(clientId, { limit: 1, windowMs: 10000 })
    expect(checkRateLimit(clientId, { limit: 1, windowMs: 10000 }).success).toBe(false)

    rateLimiter.reset(clientId)
    const fresh = checkRateLimit(clientId, { limit: 1, windowMs: 10000 })
    expect(fresh.success).toBe(true)
    expect(fresh.remaining).toBe(0)
  })

  it('extracts client IP correctly from forward proxy headers', () => {
    const headersWithForwarded = new Headers({ 'x-forwarded-for': '203.0.113.195, 70.41.3.18' })
    expect(getClientIp(headersWithForwarded)).toBe('203.0.113.195')

    const headersWithCf = new Headers({ 'cf-connecting-ip': '198.51.100.4' })
    expect(getClientIp(headersWithCf)).toBe('198.51.100.4')

    const headersWithReal = new Headers({ 'x-real-ip': '192.0.2.1' })
    expect(getClientIp(headersWithReal)).toBe('192.0.2.1')

    const emptyHeaders = new Headers()
    expect(getClientIp(emptyHeaders)).toBe('127.0.0.1')
  })
})
