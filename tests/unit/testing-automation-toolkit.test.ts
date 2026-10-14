import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  createDeterministicClock,
  createDeterministicRandom,
  createTestFactory,
  createMockFetch,
  simulateTransientFailure,
  createMockRequest,
  assertApiResponse,
  generateMockWebhookSignature,
  assertIdempotentExecution,
  PROMPT_INJECTION_VECTORS,
  validateStructuredOutput,
  validateToolCall,
  evaluateCitationGrounding,
  evaluateAgentLoopTermination,
  createTestUser,
  createTestSession,
  createTestWebhookPayload,
} from '@/lib/testing'

describe('Part 4.16 — Reusable Testing & Quality Automation Toolkit', () => {
  describe('1. Deterministic Time & PRNG Generators', () => {
    it('manages deterministic clock progression and timestamp advancement', () => {
      const clock = createDeterministicClock(1700000000000)
      expect(clock.timestamp()).toBe(1700000000000)
      expect(clock.now().toISOString()).toBe('2023-11-14T22:13:20.000Z')

      clock.advance(5000)
      expect(clock.timestamp()).toBe(1700000005000)

      clock.set(new Date('2026-01-01T00:00:00Z'))
      expect(clock.timestamp()).toBe(1767225600000)
      clock.restore()
    })

    it('generates identical pseudo-random number sequences with identical seeds', () => {
      const rng1 = createDeterministicRandom(42)
      const rng2 = createDeterministicRandom(42)

      const seq1 = [rng1(), rng1(), rng1()]
      const seq2 = [rng2(), rng2(), rng2()]

      expect(seq1).toEqual(seq2)
      expect(seq1[0]).toBeGreaterThanOrEqual(0)
      expect(seq1[0]).toBeLessThan(1)
    })
  })

  describe('2. Test Factories & Transient Failure Simulation', () => {
    it('produces customized entities using createTestFactory and domain fixtures', () => {
      const customFactory = createTestFactory({ id: 'item_1', active: true })
      const item = customFactory({ active: false })
      expect(item.id).toBe('item_1')
      expect(item.active).toBe(false)

      const user = createTestUser({ email: 'builder@hackathon.ai', role: 'admin' })
      expect(user.email).toBe('builder@hackathon.ai')
      expect(user.role).toBe('admin')
      expect(user.name).toBe('Ada Lovelace')

      const session = createTestSession({ user })
      expect(session.user.email).toBe('builder@hackathon.ai')
      expect(session.accessToken).toContain('mock-jwt-token')

      const webhook = createTestWebhookPayload({ event: 'order.created' })
      expect(webhook.event).toBe('order.created')
      expect(webhook.data).toBeDefined()
    })

    it('simulates transient failures and recovers upon retry budget', async () => {
      const unstableOperation = simulateTransientFailure(2, { status: 'success' })

      await expect(unstableOperation()).rejects.toThrow('Transient failure attempt #1')
      await expect(unstableOperation()).rejects.toThrow('Transient failure attempt #2')
      const result = await unstableOperation()
      expect(result).toEqual({ status: 'success' })
    })
  })

  describe('3. HTTP Mocking & API Assertions', () => {
    it('intercepts HTTP requests matching specified route rules', async () => {
      const mockFetch = createMockFetch([
        {
          url: '/api/v1/projects',
          method: 'GET',
          status: 200,
          response: [{ id: 'p1', name: 'Hackathon MVP' }],
        },
        {
          url: /\/api\/v1\/calculate/,
          method: 'POST',
          status: 200,
          response: async (req: Request) => {
            const body = (await req.json()) as { a?: number; b?: number }
            return { total: (body.a || 0) + (body.b || 0) }
          },
        },
      ])

      const res1 = await mockFetch('https://service.internal/api/v1/projects')
      expect(res1.status).toBe(200)
      const data1 = await res1.json()
      expect(data1).toHaveLength(1)

      const res2 = await mockFetch('https://service.internal/api/v1/calculate', {
        method: 'POST',
        body: JSON.stringify({ a: 10, b: 20 }),
      })
      const data2 = await res2.json()
      expect(data2.total).toBe(30)

      const res404 = await mockFetch('https://service.internal/api/v1/unknown')
      expect(res404.status).toBe(404)
    })

    it('builds standard Web Request objects and validates API response contracts', async () => {
      const req = createMockRequest('https://api.test/resource', {
        method: 'POST',
        body: { query: 'summarize' },
        searchParams: { limit: '5' },
      })
      expect(req.method).toBe('POST')
      expect(req.url).toContain('limit=5')

      const UserSchema = z.object({
        id: z.string(),
        name: z.string(),
      })

      const mockResponse = new Response(
        JSON.stringify({ success: true, data: { id: 'u1', name: 'Dev' } }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )

      const validation = await assertApiResponse(mockResponse, {
        status: 200,
        success: true,
        schema: UserSchema,
      })
      expect(validation.data.name).toBe('Dev')
    })

    it('verifies webhook HMAC signatures and ensures idempotent handling', async () => {
      const payload = { event: 'invoice.paid', amount: 9900 }
      const secret = 'whsec_test_secret_key'
      const sig = generateMockWebhookSignature(payload, secret, 1700000000)

      expect(sig.signature).toBeDefined()
      expect(sig.header).toContain('t=1700000000,v1=')

      let sideEffectCount = 0
      const idempotentAction = async () => {
        sideEffectCount++
        return { processed: true, code: 'OK' }
      }

      const res = await assertIdempotentExecution(idempotentAction, 3)
      expect(res.isConsistent).toBe(true)
      expect(sideEffectCount).toBe(3)
    })
  })

  describe('4. AI-Specific Evaluation & Security Utilities', () => {
    it('validates structured outputs from raw JSON and markdown code blocks', () => {
      const PlanSchema = z.object({
        task: z.string(),
        steps: z.array(z.string()),
      })

      // Raw JSON
      const rawRes = validateStructuredOutput('{"task": "Build MVP", "steps": ["Design", "Code"]}', PlanSchema)
      expect(rawRes.success).toBe(true)
      expect(rawRes.format).toBe('json_raw')
      expect(rawRes.data?.steps).toHaveLength(2)

      // Markdown wrapped
      const mdRes = validateStructuredOutput(
        'Here is the requested output:\n```json\n{"task": "Run tests", "steps": ["Unit", "E2E"]}\n```',
        PlanSchema
      )
      expect(mdRes.success).toBe(true)
      expect(mdRes.format).toBe('json_markdown')
      expect(mdRes.data?.task).toBe('Run tests')

      // Malformed / non-conforming
      const badRes = validateStructuredOutput('{"task": 123}', PlanSchema)
      expect(badRes.success).toBe(false)
    })

    it('validates tool call invocation names and argument schemas', () => {
      const SearchArgsSchema = z.object({
        query: z.string().min(1),
        maxResults: z.number().optional(),
      })

      const validCall = validateToolCall(
        { name: 'search_database', args: { query: 'hackathon winners', maxResults: 10 } },
        'search_database',
        SearchArgsSchema
      )
      expect(validCall.valid).toBe(true)

      const mismatchName = validateToolCall(
        { name: 'run_query', args: { query: 'test' } },
        'search_database'
      )
      expect(mismatchName.valid).toBe(false)
      expect(mismatchName.matchedName).toBe(false)

      const invalidArgs = validateToolCall(
        { name: 'search_database', args: { query: '' } },
        'search_database',
        SearchArgsSchema
      )
      expect(invalidArgs.valid).toBe(false)
      expect(invalidArgs.argsValid).toBe(false)
    })

    it('evaluates source grounding and citation presence to flag ungrounded claims', () => {
      const sourceDocs = [
        'The hackathon starts on Friday evening at 18:00 UTC. Participants have 48 hours to build prototypes.',
        'Prizes will be awarded for innovation, technical execution, and presentation quality.',
      ]

      const groundedAnswer =
        'The event begins on Friday at 18:00 UTC with 48 hours of prototyping [1]. Prizes evaluate innovation and technical execution [2].'
      const groundedResult = evaluateCitationGrounding(groundedAnswer, sourceDocs)
      expect(groundedResult.grounded).toBe(true)
      expect(groundedResult.citationCount).toBe(2)
      expect(groundedResult.groundingScore).toBeGreaterThanOrEqual(0.7)
      expect(groundedResult.unsupportedClaims).toHaveLength(0)

      const ungroundedAnswer =
        'The tournament requires all teams to submit proprietary blockchain hardware devices immediately.'
      const ungroundedResult = evaluateCitationGrounding(ungroundedAnswer, sourceDocs)
      expect(ungroundedResult.grounded).toBe(false)
      expect(ungroundedResult.unsupportedClaims.length).toBeGreaterThan(0)
    })

    it('evaluates agent loop termination bounds and catches repeating cycles', () => {
      // Normal termination
      const validExecution = [
        { stepNumber: 1, action: 'search' },
        { stepNumber: 2, action: 'analyze' },
        { stepNumber: 3, action: 'finish', done: true },
      ]
      const validEval = evaluateAgentLoopTermination(validExecution, 5)
      expect(validEval.terminated).toBe(true)
      expect(validEval.exceededMaxSteps).toBe(false)

      // Exceeded step limit
      const exceededExecution = Array.from({ length: 12 }, (_, i) => ({
        stepNumber: i + 1,
        action: 'think',
      }))
      const exceededEval = evaluateAgentLoopTermination(exceededExecution, 10)
      expect(exceededEval.terminated).toBe(false)
      expect(exceededEval.exceededMaxSteps).toBe(true)

      // Infinite repeating loop pattern
      const cyclicExecution = [
        { stepNumber: 1, action: 'search' },
        { stepNumber: 2, action: 'search' },
        { stepNumber: 3, action: 'search' },
      ]
      const cyclicEval = evaluateAgentLoopTermination(cyclicExecution, 10)
      expect(cyclicEval.hasInfiniteLoopPattern).toBe(true)
    })

    it('contains curated prompt injection attack vectors for resilience testing', () => {
      expect(PROMPT_INJECTION_VECTORS.length).toBeGreaterThanOrEqual(5)
      const categories = PROMPT_INJECTION_VECTORS.map((v) => v.category)
      expect(categories).toContain('direct_override')
      expect(categories).toContain('system_leak')
      expect(categories).toContain('delimiter_collision')
      expect(categories).toContain('jailbreak')
      expect(categories).toContain('markdown_exfiltration')
    })
  })
})
