import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StructuredLogger, redactSensitiveData } from '@/lib/logging/logger'

describe('StructuredLogger & Redaction', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('redacts sensitive strings containing Bearer tokens, OpenAI keys, and JWTs', () => {
    const rawString = 'Failed with Bearer eyJhbGciOi.test.token and sk-1234567890abcdef123'
    const sanitized = redactSensitiveData(rawString)
    expect(sanitized).not.toContain('eyJhbGciOi.test.token')
    expect(sanitized).not.toContain('sk-1234567890abcdef123')
    expect(sanitized).toContain('[REDACTED_SECRET]')
  })

  it('recursively redacts sensitive object keys like password, token, apiKey', () => {
    const rawObj = {
      username: 'alice',
      password: 'superSecretPassword123!',
      apiKey: 'xyz-secret-key',
      nested: {
        token: 'auth-token-123',
        publicNote: 'hello',
      },
    }

    const sanitized = redactSensitiveData(rawObj) as Record<string, unknown>
    expect(sanitized.username).toBe('alice')
    expect(sanitized.password).toBe('[REDACTED]')
    expect(sanitized.apiKey).toBe('[REDACTED]')
    const nested = sanitized.nested as Record<string, unknown>
    expect(nested.token).toBe('[REDACTED]')
    expect(nested.publicNote).toBe('hello')
  })

  it('respects log level priority and skips debug when level is info', () => {
    const logger = new StructuredLogger('info')
    logger.debug('Verbose debug information')
    expect(consoleLogSpy).not.toHaveBeenCalled()

    logger.info('User checked out', { requestId: 'req_123' })
    expect(consoleLogSpy).toHaveBeenCalledTimes(1)
    const logged = JSON.parse(consoleLogSpy.mock.calls[0][0])
    expect(logged.level).toBe('info')
    expect(logged.message).toBe('User checked out')
    expect(logged.context.requestId).toBe('req_123')
  })

  it('formats errors safely without leaking internal secrets', () => {
    const logger = new StructuredLogger('error')
    const secretError = new Error('Database connection failed with token sk-abcdef123456789')

    logger.error('Database query failed', { requestId: 'req_456' }, secretError)
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)

    const logged = JSON.parse(consoleErrorSpy.mock.calls[0][0])
    expect(logged.level).toBe('error')
    expect(logged.error.message).not.toContain('sk-abcdef123456789')
    expect(logged.error.message).toContain('[REDACTED_SECRET]')
  })
})
