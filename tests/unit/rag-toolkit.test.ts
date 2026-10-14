import { describe, it, expect, beforeEach } from 'vitest'
import {
  chunkByWord,
  chunkRecursive,
  chunkMarkdown,
  splitDocument,
  splitDocuments,
  cosineSimilarity,
  dotProduct,
  magnitude,
  normalizeVector,
  DeterministicHashEmbeddingProvider,
  createEmbeddingProvider,
  InMemoryVectorStore,
  createVectorStore,
  queryRAG,
  type Document,
} from '@/lib/rag'

describe('Reusable RAG & Document Intelligence Toolkit', () => {
  describe('Document Chunking Engine', () => {
    it('chunks text by word count with sliding window overlap', () => {
      const text = 'alpha beta gamma delta epsilon zeta eta theta iota kappa'
      const chunks = chunkByWord(text, 5, 2)

      expect(chunks.length).toBeGreaterThan(1)
      expect(chunks[0]).toBe('alpha beta gamma delta epsilon')
      // Overlap of 2 means chunk 2 starts at word index 3 (delta)
      expect(chunks[1]).toBe('delta epsilon zeta eta theta')
    })

    it('handles empty and short strings gracefully in chunkByWord', () => {
      expect(chunkByWord('')).toEqual([])
      expect(chunkByWord('short sentence', 10, 2)).toEqual(['short sentence'])
    })

    it('splits text recursively along paragraph and sentence boundaries', () => {
      const text =
        'Paragraph 1 is here.\n\nParagraph 2 has multiple sentences. Sentence two is long.\n\nParagraph 3.'
      const chunks = chunkRecursive(text, 50, 10)

      expect(chunks.length).toBeGreaterThanOrEqual(2)
      expect(chunks.some((c) => c.includes('Paragraph 1'))).toBe(true)
      expect(chunks.some((c) => c.includes('Paragraph 2'))).toBe(true)
    })

    it('splits markdown text extracting headings into chunk metadata', () => {
      const markdown = `# Architecture Overview
This is the core architecture description.

## Database Integration
Supabase PostgreSQL database is used for persistent storage.

## Real-Time Capabilities
WebSocket and SSE streams support live dashboards.`

      const chunks = chunkMarkdown(markdown, 100, 20)
      expect(chunks.length).toBeGreaterThanOrEqual(3)

      const dbChunk = chunks.find((c) => c.text.includes('PostgreSQL'))
      expect(dbChunk?.sectionHeading).toBe('Database Integration')

      const rtChunk = chunks.find((c) => c.text.includes('WebSocket'))
      expect(rtChunk?.sectionHeading).toBe('Real-Time Capabilities')
    })

    it('splits full documents preserving character offsets and metadata', () => {
      const doc: Document = {
        id: 'spec-doc-1',
        text: 'First section text goes here.\n\nSecond section continues here.',
        metadata: { author: 'Engineering', category: 'architecture' },
      }

      const chunks = splitDocument(doc, {
        strategy: 'recursive',
        chunkSize: 40,
        chunkOverlap: 10,
      })

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].documentId).toBe('spec-doc-1')
      expect(chunks[0].chunkIndex).toBe(0)
      expect(chunks[0].metadata?.author).toBe('Engineering')
      expect(chunks[0].startIndex).toBeGreaterThanOrEqual(0)
      expect(chunks[0].endIndex).toBeGreaterThan(chunks[0].startIndex!)
    })

    it('splits multiple documents in batch', () => {
      const docs: Document[] = [
        { id: 'doc-a', text: 'Document A content.' },
        { id: 'doc-b', text: 'Document B content.' },
      ]

      const chunks = splitDocuments(docs, { chunkSize: 50 })
      expect(chunks).toHaveLength(2)
      expect(chunks[0].documentId).toBe('doc-a')
      expect(chunks[1].documentId).toBe('doc-b')
    })
  })

  describe('Vector Math & Deterministic Embeddings', () => {
    it('computes dotProduct, magnitude, and normalizeVector', () => {
      const v = [3, 4]
      expect(magnitude(v)).toBe(5)
      expect(normalizeVector(v)).toEqual([0.6, 0.8])
      expect(dotProduct([1, 2], [3, 4])).toBe(11)
    })

    it('computes cosine similarity accurately', () => {
      const a = [1, 0, 0]
      const b = [1, 0, 0]
      const c = [0, 1, 0]
      const d = [-1, 0, 0]

      expect(cosineSimilarity(a, b)).toBeCloseTo(1.0)
      expect(cosineSimilarity(a, c)).toBeCloseTo(0.0)
      expect(cosineSimilarity(a, d)).toBeCloseTo(-1.0)
      expect(cosineSimilarity([], [])).toBe(0)
    })

    it('generates deterministic embeddings without network calls', async () => {
      const provider = new DeterministicHashEmbeddingProvider(64)
      const textA = 'Next.js 16 App Router Turbopack'
      const textB = 'Next.js 16 App Router Turbopack'
      const textC = 'Completely different topic about gardening'

      const vecA = await provider.embed(textA)
      const vecB = await provider.embed(textB)
      const vecC = await provider.embed(textC)

      expect(vecA).toHaveLength(64)
      expect(vecA).toEqual(vecB) // Deterministic stability

      // Semantic similarity check: identical text = 1.0, unrelated text < 0.6
      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0)
      expect(cosineSimilarity(vecA, vecC)).toBeLessThan(0.7)
    })

    it('falls back to deterministic mock provider when OpenAI key is absent', () => {
      delete process.env.OPENAI_API_KEY
      const provider = createEmbeddingProvider('openai')
      expect(provider).toBeInstanceOf(DeterministicHashEmbeddingProvider)
    })
  })

  describe('InMemoryVectorStore & Hybrid Search', () => {
    let store: InMemoryVectorStore

    beforeEach(async () => {
      store = createVectorStore()
      await store.addChunks([
        {
          id: 'chunk-1',
          documentId: 'doc-next',
          text: 'Next.js 16 provides Turbopack, App Router, and Server Actions.',
          chunkIndex: 0,
          metadata: { framework: 'react', type: 'web' },
        },
        {
          id: 'chunk-2',
          documentId: 'doc-supabase',
          text: 'Supabase PostgreSQL database supports Auth, Storage, and Realtime.',
          chunkIndex: 0,
          metadata: { framework: 'postgres', type: 'database' },
        },
        {
          id: 'chunk-3',
          documentId: 'doc-vitest',
          text: 'Vitest is a blazing fast unit and component testing framework.',
          chunkIndex: 0,
          metadata: { framework: 'testing', type: 'qa' },
        },
      ])
    })

    it('indexes chunks and returns chunk count', () => {
      expect(store.getChunkCount()).toBe(3)
    })

    it('retrieves relevant chunks via vector search', async () => {
      const results = await store.search('Turbopack App Router', {
        mode: 'vector',
        topK: 1,
      })

      expect(results).toHaveLength(1)
      expect(results[0].documentId).toBe('doc-next')
      expect(results[0].vectorScore).toBeGreaterThan(0.5)
    })

    it('retrieves relevant chunks via keyword search', async () => {
      const results = await store.search('PostgreSQL Auth database', {
        mode: 'keyword',
        topK: 1,
      })

      expect(results).toHaveLength(1)
      expect(results[0].documentId).toBe('doc-supabase')
      expect(results[0].keywordScore).toBeGreaterThan(0.5)
    })

    it('performs hybrid search combining vector and keyword scores', async () => {
      const results = await store.search('testing framework Vitest', {
        mode: 'hybrid',
        alpha: 0.5,
        topK: 2,
      })

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].documentId).toBe('doc-vitest')
      expect(results[0].score).toBeGreaterThan(0.4)
      expect(results[0].vectorScore).toBeDefined()
      expect(results[0].keywordScore).toBeDefined()
    })

    it('filters chunks by metadata attributes', async () => {
      const results = await store.search('framework', {
        mode: 'hybrid',
        filter: { type: 'database' },
      })

      expect(results).toHaveLength(1)
      expect(results[0].documentId).toBe('doc-supabase')
    })

    it('deletes chunks by chunk ID and by document ID', () => {
      expect(store.deleteChunk('chunk-1')).toBe(true)
      expect(store.getChunkCount()).toBe(2)

      expect(store.deleteByDocumentId('doc-supabase')).toBe(1)
      expect(store.getChunkCount()).toBe(1)

      store.clear()
      expect(store.getChunkCount()).toBe(0)
    })
  })

  describe('Source-Grounded Question Answering Pipeline', () => {
    let store: InMemoryVectorStore

    beforeEach(async () => {
      store = createVectorStore()
      await store.addChunks([
        {
          id: 'chunk-kb-1',
          documentId: 'kb-auth',
          text: 'Users must confirm their email within 24 hours to complete registration.',
          chunkIndex: 0,
          metadata: { source: 'auth-guide.md' },
        },
        {
          id: 'chunk-kb-2',
          documentId: 'kb-rate-limit',
          text: 'The API rate limit is 100 requests per minute per IP address.',
          chunkIndex: 0,
          metadata: { source: 'api-security.md' },
        },
      ])
    })

    it('answers queries with numbered citations matching retrieved sources', async () => {
      const result = await queryRAG('What is the rate limit?', store, {
        topK: 1,
        provider: 'mock',
      })

      expect(result.grounded).toBe(true)
      expect(result.citations).toHaveLength(1)
      expect(result.citations[0].index).toBe(1)
      expect(result.citations[0].source).toBe('api-security.md')
      expect(result.citations[0].snippet).toContain('100 requests')
      expect(result.sourcesUsed).toBe(1)
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
      expect(result.answer).toBeDefined()
    })

    it('enforces strict grounding when no sources match query', async () => {
      const result = await queryRAG('What is the capital of Mars?', store, {
        minScore: 0.95, // Impossibly high score for this query
        strictGrounding: true,
        provider: 'mock',
      })

      expect(result.grounded).toBe(false)
      expect(result.sourcesUsed).toBe(0)
      expect(result.citations).toHaveLength(0)
      expect(result.answer).toContain('I cannot answer this question based on the provided documents')
    })

    it('handles empty queries gracefully', async () => {
      const result = await queryRAG('   ', store)
      expect(result.grounded).toBe(false)
      expect(result.error).toBe('EMPTY_QUERY')
      expect(result.answer).toContain('cannot be empty')
    })
  })
})
