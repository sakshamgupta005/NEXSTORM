/**
 * In-Memory Vector Store & Hybrid Retrieval Engine
 * 
 * Inspired by:
 * - Chroma: Document & metadata indexing with filtering
 * - LlamaIndex: VectorStoreIndex & Node retrieval
 * - RAGFlow: Hybrid search (combining dense embeddings + sparse keyword matching)
 */

import type { Chunk, ScoredChunk, SearchOptions } from './types'
import {
  cosineSimilarity,
  createEmbeddingProvider,
  type EmbeddingProvider,
} from './embeddings'

interface StoredVectorChunk extends Chunk {
  vector: number[]
}

export class InMemoryVectorStore {
  private chunks = new Map<string, StoredVectorChunk>()
  private embeddingProvider: EmbeddingProvider

  constructor(embeddingProvider?: EmbeddingProvider) {
    this.embeddingProvider = embeddingProvider || createEmbeddingProvider('mock')
  }

  /**
   * Embeds and indexes chunks into the vector store.
   */
  async addChunks(chunks: Chunk[]): Promise<number> {
    if (chunks.length === 0) return 0

    const texts = chunks.map((c) => c.text)
    const vectors = await this.embeddingProvider.embedBatch(texts)

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const vector = vectors[i]
      this.chunks.set(chunk.id, {
        ...chunk,
        vector,
      })
    }

    return chunks.length
  }

  deleteChunk(id: string): boolean {
    return this.chunks.delete(id)
  }

  deleteByDocumentId(documentId: string): number {
    let deleted = 0
    for (const [id, chunk] of this.chunks.entries()) {
      if (chunk.documentId === documentId) {
        this.chunks.delete(id)
        deleted++
      }
    }
    return deleted
  }

  getChunkCount(): number {
    return this.chunks.size
  }

  clear(): void {
    this.chunks.clear()
  }

  /**
   * Searches the store with optional vector, keyword, or hybrid scoring.
   */
  async search(query: string, options?: SearchOptions): Promise<ScoredChunk[]> {
    const trimmed = query.trim()
    if (!trimmed || this.chunks.size === 0) return []

    const topK = options?.topK ?? 5
    const minScore = options?.minScore ?? 0.05
    const mode = options?.mode ?? 'hybrid'
    const alpha = Math.max(0, Math.min(1, options?.alpha ?? 0.6)) // 0.6 vector, 0.4 keyword

    // 1. Prepare query vector and tokens
    let queryVector: number[] = []
    if (mode === 'vector' || mode === 'hybrid') {
      queryVector = await this.embeddingProvider.embed(trimmed)
    }

    const queryTokens = new Set(
      trimmed
        .toLowerCase()
        .split(/\W+/)
        .filter((t) => t.length > 2)
    )

    const scored: ScoredChunk[] = []

    for (const stored of this.chunks.values()) {
      // Metadata filter check
      if (options?.filter && !this.matchesFilter(stored.metadata, options.filter)) {
        continue
      }

      let vectorScore = 0
      let keywordScore = 0

      // Dense vector similarity
      if (mode === 'vector' || mode === 'hybrid') {
        const rawSim = cosineSimilarity(queryVector, stored.vector)
        // Normalize cosine [-1, 1] to [0, 1]
        vectorScore = Math.max(0, (rawSim + 1) / 2)
      }

      // Sparse keyword token overlap
      if (mode === 'keyword' || mode === 'hybrid') {
        if (queryTokens.size > 0) {
          const chunkText = stored.text.toLowerCase()
          let matches = 0
          for (const token of queryTokens) {
            if (chunkText.includes(token)) {
              matches++
            }
          }
          keywordScore = matches / queryTokens.size
        }
      }

      // Combined score calculation
      let finalScore = 0
      if (mode === 'vector') finalScore = vectorScore
      else if (mode === 'keyword') finalScore = keywordScore
      else {
        finalScore = alpha * vectorScore + (1 - alpha) * keywordScore
      }

      const roundedScore = Math.round(finalScore * 1000) / 1000

      if (roundedScore >= minScore) {
        scored.push({
          id: stored.id,
          documentId: stored.documentId,
          text: stored.text,
          chunkIndex: stored.chunkIndex,
          startIndex: stored.startIndex,
          endIndex: stored.endIndex,
          metadata: stored.metadata,
          score: roundedScore,
          vectorScore: Math.round(vectorScore * 1000) / 1000,
          keywordScore: Math.round(keywordScore * 1000) / 1000,
        })
      }
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }

  private matchesFilter(
    metadata?: Record<string, unknown>,
    filter?: Record<string, unknown>
  ): boolean {
    if (!filter) return true
    if (!metadata) return false

    for (const [key, val] of Object.entries(filter)) {
      if (metadata[key] !== val) return false
    }
    return true
  }
}

export function createVectorStore(embeddingProvider?: EmbeddingProvider): InMemoryVectorStore {
  return new InMemoryVectorStore(embeddingProvider)
}
