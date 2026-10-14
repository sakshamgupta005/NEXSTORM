import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateText, generateStructured } from '@/lib/ai/client'
import { z } from 'zod'

describe('Unified AI Client & Adapters', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete process.env.OPENAI_API_KEY
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
    delete process.env.GROQ_API_KEY
  })

  // 1. Basic Generation & Mock Mode
  it('generates text using mock provider when no provider specified and no keys set', async () => {
    const res = await generateText({ prompt: 'Hello world' })
    expect(res.success).toBe(true)
    expect(res.provider).toBe('mock')
    expect(res.data).toContain('Mock AI Response')
    expect(res.attempts).toBe(1)
    expect(res.fallbackAttempted).toBe(false)
    expect(res.latencyMs).toBeGreaterThanOrEqual(0)
  })

  // 2. Missing Key Error Normalization
  it('normalizes missing key errors without attempting unconfigured fallback', async () => {
    const res = await generateText({ prompt: 'Hello', provider: 'openai' })
    expect(res.success).toBe(false)
    expect(res.errorDetail?.code).toBe('MISSING_API_KEY')
    expect(res.error).toContain('Missing API key for provider openai')
    expect(res.fallbackAttempted).toBe(false)
    expect(res.attempts).toBe(1)
  })

  it('normalizes missing Gemini key errors', async () => {
    const res = await generateText({ prompt: 'Hello', provider: 'gemini' })
    expect(res.success).toBe(false)
    expect(res.errorDetail?.code).toBe('MISSING_API_KEY')
    expect(res.error).toContain('Missing GOOGLE_GENERATIVE_AI_API_KEY')
  })

  // 3. Explicit Provider Fallback
  it('executes explicit fallback provider when primary provider fails', async () => {
    // Primary 'openai' will fail because OPENAI_API_KEY is missing
    const res = await generateText({
      prompt: 'Summarize',
      provider: 'openai',
      fallback: 'mock',
    })

    expect(res.success).toBe(true)
    expect(res.provider).toBe('mock')
    expect(res.fallbackAttempted).toBe(true)
    expect(res.attempts).toBe(2)
    expect(res.primaryError).toContain('Missing API key for provider openai')
    expect(res.data).toContain('Mock AI Response')
  })

  it('does NOT execute fallback when primary provider succeeds', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key'
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        choices: [{ message: { content: 'Primary response' } }],
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
      }),
    })

    const res = await generateText({
      prompt: 'Hello',
      provider: 'openai',
      fallback: 'mock',
    })

    expect(res.success).toBe(true)
    expect(res.provider).toBe('openai')
    expect(res.fallbackAttempted).toBe(false)
    expect(res.attempts).toBe(1)
    expect(res.data).toBe('Primary response')
  })

  // 4. Rate Limiting & Timeout Normalization
  it('normalizes HTTP 429 rate limit errors from upstream', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: new Headers(),
      text: async () => 'Rate limit exceeded. Quota reached.',
    })

    const res = await generateText({ prompt: 'Hello', provider: 'openai' })
    expect(res.success).toBe(false)
    expect(res.errorDetail?.code).toBe('RATE_LIMITED')
    expect(res.errorDetail?.status).toBe(429)
    expect(res.errorDetail?.retryable).toBe(true)
  })

  it('normalizes provider network timeouts', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    global.fetch = vi.fn().mockImplementation(() => {
      const err = new Error('The operation was aborted')
      err.name = 'AbortError'
      return Promise.reject(err)
    })

    const res = await generateText({ prompt: 'Slow request', provider: 'openai', timeoutMs: 10 })
    expect(res.success).toBe(false)
    expect(res.errorDetail?.code).toBe('TIMEOUT')
    expect(res.errorDetail?.retryable).toBe(true)
  })

  // 5. Falsy Mock Fixtures Support
  it('returns falsy mock fixtures correctly (boolean false, number 0, empty string)', async () => {
    const boolSchema = z.boolean()
    const boolRes = await generateStructured({
      prompt: 'Is active?',
      provider: 'mock',
      schema: boolSchema,
      mockResponse: false,
    })
    expect(boolRes.success).toBe(true)
    expect(boolRes.data).toBe(false)

    const zeroSchema = z.number()
    const zeroRes = await generateStructured({
      prompt: 'Get count',
      provider: 'mock',
      schema: zeroSchema,
      mockResponse: 0,
    })
    expect(zeroRes.success).toBe(true)
    expect(zeroRes.data).toBe(0)

    const emptyStringSchema = z.string()
    const emptyStringRes = await generateStructured({
      prompt: 'Get text',
      provider: 'mock',
      schema: emptyStringSchema,
      mockResponse: '',
    })
    expect(emptyStringRes.success).toBe(true)
    expect(emptyStringRes.data).toBe('')
  })

  // 6. Structured Output & Bounded Repair Mechanism
  it('parses valid JSON structured output', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        choices: [{ message: { content: '{"answer": "Berlin", "score": 100}' } }],
        usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
      }),
    })

    const schema = z.object({ answer: z.string(), score: z.number() })
    const res = await generateStructured({ prompt: 'Capital of Germany?', provider: 'openai', schema })

    expect(res.success).toBe(true)
    expect(res.data).toEqual({ answer: 'Berlin', score: 100 })
    expect(res.repairAttempts).toBe(0)
    expect(res.usage?.totalTokens).toBe(20)
  })

  it('repairs malformed JSON when maxRepairAttempts > 0', async () => {
    process.env.OPENAI_API_KEY = 'test-key'

    // First call returns malformed JSON, second call returns valid JSON
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          choices: [{ message: { content: 'Invalid JSON { answer: Berlin' } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          choices: [{ message: { content: '{"answer": "Berlin", "score": 100}' } }],
        }),
      })

    const schema = z.object({ answer: z.string(), score: z.number() })
    const res = await generateStructured({
      prompt: 'Capital of Germany?',
      provider: 'openai',
      schema,
      maxRepairAttempts: 1,
    })

    expect(res.success).toBe(true)
    expect(res.data).toEqual({ answer: 'Berlin', score: 100 })
    expect(res.repairAttempts).toBe(1)
  })

  it('strictly bounds repair attempts and reports failure when repair limit is reached', async () => {
    process.env.OPENAI_API_KEY = 'test-key'

    // Always returns invalid JSON
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        choices: [{ message: { content: 'Still invalid JSON' } }],
      }),
    })

    const schema = z.object({ answer: z.string() })
    const res = await generateStructured({
      prompt: 'Question',
      provider: 'openai',
      schema,
      maxRepairAttempts: 1,
    })

    expect(res.success).toBe(false)
    expect(res.errorDetail?.code).toBe('INVALID_RESPONSE')
    expect(res.repairAttempts).toBe(1)
  })

  // 7. Token Usage Transparency
  it('does NOT invent token counts if provider response omits them', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        choices: [{ message: { content: 'Hello' } }],
        // usage field is omitted
      }),
    })

    const res = await generateText({ prompt: 'Hello', provider: 'openai' })
    expect(res.success).toBe(true)
    expect(res.usage).toBeUndefined()
  })
})
