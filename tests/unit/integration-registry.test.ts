import { describe, it, expect, beforeEach, vi } from 'vitest'
import { z } from 'zod'
import {
  createIntegrationRegistry,
  getIntegrationRegistry,
  inMemoryRAGDefinition,
  mockSearchDefinition,
  tavilySearchDefinition,
  inMemoryQueueDefinition,
  mockOCRDefinition,
  httpOCRDefinition,
  mockSpeechDefinition,
  mockVisionDefinition,
  mockDocUnderstandingDefinition,
  sharedInMemoryRAGIndex,
  sharedInMemoryQueue,
  type IntegrationDefinition,
  type RAGRetrieveInput,
  type RAGRetrieveOutput,
  type WebSearchInput,
  type WebSearchOutput,
  type QueueAddJobInput,
  type QueueJobOutput,
  type OCRInput,
  type OCROutput,
  type SpeechTranscriptionInput,
  type SpeechTranscriptionOutput,
  type VisionInput,
  type VisionOutput,
  type DocUnderstandingInput,
  type DocUnderstandingOutput,
} from '@/lib/integrations'

describe('Modular Integration Framework', () => {
  let registry: ReturnType<typeof createIntegrationRegistry>

  beforeEach(() => {
    registry = createIntegrationRegistry()
    sharedInMemoryRAGIndex.clear()
    sharedInMemoryQueue.clear()
    vi.restoreAllMocks()
  })

  describe('Registration & Discovery', () => {
    it('registers valid integration definition and looks it up by ID', () => {
      registry.register(inMemoryRAGDefinition)
      expect(registry.has('rag:in-memory')).toBe(true)
      const def = registry.get('rag:in-memory')
      expect(def).toBeDefined()
      expect(def?.name).toBe('In-Memory Document Retriever')
      expect(def?.category).toBe('rag')
      expect(def?.license).toBe('MIT')
    })

    it('rejects duplicate registration unless overwrite: true is passed', () => {
      registry.register(inMemoryRAGDefinition)
      expect(() => registry.register(inMemoryRAGDefinition)).toThrow(
        /already registered/
      )

      expect(() =>
        registry.register(inMemoryRAGDefinition, { overwrite: true })
      ).not.toThrow()
    })

    it('validates required fields during registration', () => {
      expect(() =>
        registry.register({} as unknown as IntegrationDefinition)
      ).toThrow(/"id" must be a non-empty string/)

      expect(() =>
        registry.register({ id: 'test' } as unknown as IntegrationDefinition)
      ).toThrow(/"category" is required/)

      expect(() =>
        registry.register({ id: 'test', category: 'rag' } as unknown as IntegrationDefinition)
      ).toThrow(/"createAdapter" must be a function/)
    })

    it('filters integrations by category', () => {
      registry.register(inMemoryRAGDefinition)
      registry.register(mockSearchDefinition)
      registry.register(inMemoryQueueDefinition)

      expect(registry.list()).toHaveLength(3)
      expect(registry.list('rag')).toHaveLength(1)
      expect(registry.list('search')).toHaveLength(1)
      expect(registry.list('speech')).toHaveLength(0)
    })

    it('identifies available integrations based on configuration status', () => {
      registry.register(mockSearchDefinition) // configured: true
      registry.register(tavilySearchDefinition) // configured: false without key

      const available = registry.getAvailable('search')
      expect(available.some((d) => d.id === 'search:mock')).toBe(true)
    })
  })

  describe('Configuration & Missing Dependency Handling', () => {
    it('returns normalized NOT_CONFIGURED error when executing an unconfigured provider', async () => {
      delete process.env.TAVILY_API_KEY
      registry.register(tavilySearchDefinition)

      const result = await registry.execute('search:tavily', {
        query: 'nextjs',
      })

      expect(result.success).toBe(false)
      expect(result.errorDetail?.code).toBe('NOT_CONFIGURED')
      expect(result.error).toContain('is not configured')
      expect(result.errorDetail?.details?.requiredEnvVars).toContain('TAVILY_API_KEY')
    })

    it('returns normalized NOT_REGISTERED error for unknown integration IDs', async () => {
      const result = await registry.execute('unknown:service', {
        foo: 'bar',
      })

      expect(result.success).toBe(false)
      expect(result.errorDetail?.code).toBe('NOT_REGISTERED')
    })

    it('reports unhealthy status when checking health of unconfigured integration', async () => {
      delete process.env.OCR_SERVICE_URL
      registry.register(httpOCRDefinition)

      const health = await registry.checkHealth('ocr:http')
      expect(health.status).toBe('unhealthy')
      expect(health.message).toContain('OCR_SERVICE_URL')
    })
  })

  describe('Input Validation, Timeout & Cancellation', () => {
    it('validates inputs using Zod schemas when defined', async () => {
      registry.register({
        id: 'test:schema',
        category: 'rag',
        name: 'Schema Test',
        description: 'Test',
        referenceRepo: '',
        license: 'MIT',
        isConfigured: () => true,
        inputSchema: z.object({
          requiredField: z.string().min(5),
        }),
        createAdapter: () => ({
          execute: async () => ({ ok: true }),
        }),
      })

      const invalidResult = await registry.execute('test:schema', {
        requiredField: 'no',
      })
      expect(invalidResult.success).toBe(false)
      expect(invalidResult.errorDetail?.code).toBe('INVALID_INPUT')

      const validResult = await registry.execute('test:schema', {
        requiredField: 'long enough text',
      })
      expect(validResult.success).toBe(true)
    })

    it('enforces execution timeouts and normalizes to TIMEOUT code', async () => {
      registry.register({
        id: 'test:timeout',
        category: 'queue',
        name: 'Timeout Test',
        description: 'Test',
        referenceRepo: '',
        license: 'MIT',
        isConfigured: () => true,
        createAdapter: () => ({
          execute: async () => {
            await new Promise((resolve) => setTimeout(resolve, 200))
            return { done: true }
          },
        }),
      })

      const result = await registry.execute(
        'test:timeout',
        {},
        { timeoutMs: 30 }
      )

      expect(result.success).toBe(false)
      expect(result.errorDetail?.code).toBe('TIMEOUT')
      expect(result.errorDetail?.recoverable).toBe(true)
    })

    it('handles AbortSignal cancellation before and during execution', async () => {
      registry.register({
        id: 'test:abort',
        category: 'queue',
        name: 'Abort Test',
        description: 'Test',
        referenceRepo: '',
        license: 'MIT',
        isConfigured: () => true,
        createAdapter: () => ({
          execute: async () => {
            await new Promise((resolve) => setTimeout(resolve, 150))
            return { ok: true }
          },
        }),
      })

      // Pre-aborted signal
      const preAborted = AbortSignal.abort()
      const preResult = await registry.execute('test:abort', {}, { signal: preAborted })
      expect(preResult.success).toBe(false)
      expect(preResult.errorDetail?.code).toBe('CANCELLED')

      // Mid-flight abort
      const controller = new AbortController()
      setTimeout(() => controller.abort(), 20)

      const midResult = await registry.execute(
        'test:abort',
        {},
        { signal: controller.signal }
      )
      expect(midResult.success).toBe(false)
      expect(midResult.errorDetail?.code).toBe('CANCELLED')
    })
  })

  describe('Reference Implementations & Mock Adapters', () => {
    it('executes in-memory RAG indexer and retrieval (LlamaIndex pattern)', async () => {
      registry.register(inMemoryRAGDefinition)

      // Add sample documents to shared index
      sharedInMemoryRAGIndex.addDocuments({
        documents: [
          {
            id: 'doc-1',
            text: 'Supabase provides real-time PostgreSQL database subscriptions and authentication.',
          },
          {
            id: 'doc-2',
            text: 'Next.js App Router utilizes React Server Components and Turbopack for high-speed builds.',
          },
        ],
        chunkSize: 100,
        chunkOverlap: 10,
      })

      const result = await registry.execute<RAGRetrieveInput, RAGRetrieveOutput>('rag:in-memory', {
        query: 'PostgreSQL database',
        topK: 1,
      })

      expect(result.success).toBe(true)
      expect(result.data?.results.length).toBeGreaterThan(0)
      expect(result.data?.results[0].text).toContain('PostgreSQL')
      expect(result.data?.results[0].score).toBeGreaterThan(0)
    })

    it('executes mock web search (Tavily pattern)', async () => {
      registry.register(mockSearchDefinition)

      const result = await registry.execute<WebSearchInput, WebSearchOutput>('search:mock', {
        query: 'nextjs documentation',
        maxResults: 2,
        includeAnswer: true,
      })

      expect(result.success).toBe(true)
      expect(result.data?.results.length).toBeLessThanOrEqual(2)
      expect(result.data?.results[0].title).toContain('Next.js')
      expect(result.data?.answer).toBeDefined()
    })

    it('executes in-memory background job queue (BullMQ pattern)', async () => {
      registry.register(inMemoryQueueDefinition)

      const addResult = await registry.execute<QueueAddJobInput, QueueJobOutput>('queue:in-memory', {
        name: 'send-email',
        data: { recipient: 'user@example.com' },
        priority: 10,
      })

      expect(addResult.success).toBe(true)
      expect(addResult.data?.jobId).toMatch(/^job-/)
      expect(addResult.data?.status).toBe('waiting')

      // Process job with worker
      const processed = await sharedInMemoryQueue.processNext(async (job) => {
        const payload = job.data as { recipient: string }
        return { delivered: true, recipient: payload.recipient }
      })

      expect(processed?.status).toBe('completed')
      expect(processed?.result).toEqual({
        delivered: true,
        recipient: 'user@example.com',
      })
    })

    it('executes mock OCR adapter (PaddleOCR pattern)', async () => {
      registry.register(mockOCRDefinition)

      const result = await registry.execute<OCRInput, OCROutput>('ocr:mock', {
        imageUrl: 'https://example.com/receipt.png',
      })

      expect(result.success).toBe(true)
      expect(result.data?.text).toContain('INVOICE')
      expect(result.data?.lines.length).toBeGreaterThan(0)
      expect(result.data?.confidence).toBeGreaterThan(0.9)
    })

    it('executes mock speech transcription adapter (Faster-Whisper pattern)', async () => {
      registry.register(mockSpeechDefinition)

      const result = await registry.execute<SpeechTranscriptionInput, SpeechTranscriptionOutput>('speech:mock', {
        audioUrl: 'https://example.com/voice.wav',
      })

      expect(result.success).toBe(true)
      expect(result.data?.text).toContain('hackathon')
      expect(result.data?.segments.length).toBe(2)
      expect(result.data?.duration).toBeGreaterThan(0)
    })

    it('executes mock vision analysis adapter (Transformers pattern)', async () => {
      registry.register(mockVisionDefinition)

      const result = await registry.execute<VisionInput, VisionOutput>('vision:mock', {
        imageUrl: 'https://example.com/desk.jpg',
        task: 'vqa',
        prompt: 'laptop',
      })

      expect(result.success).toBe(true)
      expect(result.data?.description).toContain('workspace')
      expect(result.data?.answer).toContain('laptop')
    })

    it('executes mock document understanding adapter (RAGFlow pattern)', async () => {
      registry.register(mockDocUnderstandingDefinition)

      const result = await registry.execute<DocUnderstandingInput, DocUnderstandingOutput>('doc_understanding:mock', {
        documentUrl: 'https://example.com/annual-report.pdf',
        extractTables: true,
      })

      expect(result.success).toBe(true)
      expect(result.data?.summary).toBeDefined()
      expect(result.data?.sections.length).toBe(2)
      expect(result.data?.tables.length).toBe(1)
      expect(result.data?.tables[0].headers).toContain('Quarter')
    })
  })

  describe('Preloaded Registry & Zero-Config Behavior', () => {
    it('returns preloaded registry with all 12 standard definitions registered', () => {
      const reg = getIntegrationRegistry()
      expect(reg.list().length).toBeGreaterThanOrEqual(12)
      expect(reg.has('rag:in-memory')).toBe(true)
      expect(reg.has('search:mock')).toBe(true)
      expect(reg.has('queue:in-memory')).toBe(true)
      expect(reg.has('ocr:mock')).toBe(true)
      expect(reg.has('speech:mock')).toBe(true)
      expect(reg.has('vision:mock')).toBe(true)
      expect(reg.has('doc_understanding:mock')).toBe(true)
    })

    it('confirms the application operates without any external environment variables configured', () => {
      const reg = getIntegrationRegistry()
      // All mock adapters work without credentials
      const mockIntegrations = [
        'rag:in-memory',
        'search:mock',
        'queue:in-memory',
        'ocr:mock',
        'speech:mock',
        'vision:mock',
        'doc_understanding:mock',
      ]

      for (const id of mockIntegrations) {
        const def = reg.get(id)
        expect(def?.isConfigured()).toBe(true)
      }
    })
  })
})
