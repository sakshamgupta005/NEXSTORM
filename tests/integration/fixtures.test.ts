import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockUser, createMockSession } from '../fixtures/auth'
import { createMockJsonResponse, createMockErrorResponse } from '../fixtures/api'
import { createMockOpenAIPayload } from '../fixtures/ai'
import { safeFetch } from '@/lib/api/client'
import { generateText } from '@/lib/ai/client'

describe('Reusable Test Fixtures Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('generates customized mock users and sessions', () => {
    const user = createMockUser({ email: 'champion@hackathon.dev' })
    expect(user.email).toBe('champion@hackathon.dev')
    expect(user.role).toBe('authenticated')

    const session = createMockSession({ user })
    expect(session.user.email).toBe('champion@hackathon.dev')
    expect(session.access_token).toBeDefined()
  })

  it('mocks fetch requests reliably using createMockJsonResponse with safeFetch', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      createMockJsonResponse({ status: 'ok', score: 99 })
    )

    const res = await safeFetch<{ status: string; score: number }>('https://api.test/data')
    expect(res.ok).toBe(true)
    expect(res.data?.score).toBe(99)
  })

  it('mocks AI provider responses using createMockOpenAIPayload', async () => {
    process.env.OPENAI_API_KEY = 'mock-key-for-fixture-test'
    global.fetch = vi.fn().mockResolvedValue(
      createMockJsonResponse(createMockOpenAIPayload('Generated hackathon solution', 50))
    )

    const res = await generateText({ prompt: 'Build an app', provider: 'openai' })
    expect(res.success).toBe(true)
    expect(res.data).toBe('Generated hackathon solution')
    expect(res.usage?.totalTokens).toBe(50)
    delete process.env.OPENAI_API_KEY
  })

  it('handles simulated HTTP 500 error fixtures without uncaught exceptions', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      createMockErrorResponse(500, 'Internal Server Error')
    )

    const res = await safeFetch('https://api.test/fail', { retries: 0 })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(500)
    expect(res.error).toBe('Internal Server Error')
  })
})
