import { describe, it, expect, vi, beforeEach } from 'vitest'
import { safeFetch } from '@/lib/api/client'
import { z } from 'zod'

describe('safeFetch resilient API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('successfully returns parsed JSON data on 200 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ message: 'ok', count: 42 }),
    })

    const result = await safeFetch<{ message: string; count: number }>('https://api.example.com/data')
    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
    expect(result.data).toEqual({ message: 'ok', count: 42 })
    expect(result.requestId).toBeDefined()
    expect(result.attempts).toBe(1)
  })

  it('validates response against Zod schema and fails if schema mismatch occurs', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ message: 'ok', count: 'not-a-number' }),
    })

    const testSchema = z.object({
      message: z.string(),
      count: z.number(),
    })

    const result = await safeFetch('https://api.example.com/data', {
      schema: testSchema,
      retries: 0,
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Schema validation failed')
  })

  it('handles client errors (400) without retrying', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      headers: new Headers(),
      text: async () => 'Invalid parameter',
    })

    const result = await safeFetch('https://api.example.com/bad', { retries: 2 })
    expect(result.ok).toBe(false)
    expect(result.status).toBe(400)
    expect(result.attempts).toBe(1)
    expect(result.error).toBe('Invalid parameter')
  })

  it('retries on server errors (500) up to retries count', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers(),
      text: async () => 'Server error',
    })

    const result = await safeFetch('https://api.example.com/err', {
      retries: 2,
      retryDelayMs: 1,
    })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(500)
    expect(result.attempts).toBe(3) // 1 initial + 2 retries
  })

  it('handles network timeout and abort gracefully', async () => {
    global.fetch = vi.fn().mockImplementation(() => {
      const err = new Error('The operation was aborted')
      err.name = 'AbortError'
      return Promise.reject(err)
    })

    const result = await safeFetch('https://api.example.com/timeout', {
      timeoutMs: 10,
      retries: 0,
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('timed out')
  })

  it('does NOT retry non-idempotent POST requests on 500 error by default', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers(),
      text: async () => 'Internal Error',
    })

    const result = await safeFetch('https://api.example.com/charge', {
      method: 'POST',
      retries: 2,
      retryDelayMs: 1,
    })

    expect(result.ok).toBe(false)
    expect(result.attempts).toBe(1) // Not retried because POST is non-idempotent
  })

  it('retries non-idempotent requests when explicitly marked idempotent: true', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers(),
      text: async () => 'Internal Error',
    })

    const result = await safeFetch('https://api.example.com/safe-post', {
      method: 'POST',
      idempotent: true,
      retries: 2,
      retryDelayMs: 1,
    })

    expect(result.ok).toBe(false)
    expect(result.attempts).toBe(3) // Retried because explicitly idempotent
  })
})

