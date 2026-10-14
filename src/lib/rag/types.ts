/**
 * Reusable RAG & Document Intelligence Toolkit — Types & Contracts
 * 
 * Inspired by:
 * - LlamaIndex: Document abstraction, chunking, and query engine
 * - RAGFlow: Structural document awareness & hybrid retrieval
 * - LangChain.js: Recursive text splitter & citation chains
 * - Chroma: Vector store interface & metadata filtering
 * - Transformers.js: Standard embedding representation
 */

import type { AIProvider, AIUsage } from '../ai/types'

export interface Document {
  id: string
  text: string
  metadata?: Record<string, unknown>
}

export interface Chunk {
  id: string
  documentId: string
  text: string
  chunkIndex: number
  startIndex?: number
  endIndex?: number
  metadata?: Record<string, unknown>
}

export type ChunkingStrategy = 'character' | 'word' | 'markdown' | 'recursive'

export interface ChunkingOptions {
  strategy?: ChunkingStrategy
  chunkSize?: number
  chunkOverlap?: number
  minChunkSize?: number
  separators?: string[]
}

export interface ScoredChunk extends Chunk {
  score: number
  vectorScore?: number
  keywordScore?: number
}

export type RetrievalMode = 'vector' | 'keyword' | 'hybrid'

export interface SearchOptions {
  topK?: number
  minScore?: number
  filter?: Record<string, unknown>
  mode?: RetrievalMode
  /** Hybrid weight: 1.0 = 100% vector, 0.0 = 100% keyword, default 0.6 */
  alpha?: number
}

export interface Citation {
  index: number
  source: string
  documentId: string
  chunkId: string
  snippet: string
  score: number
}

export interface RAGPipelineOptions {
  topK?: number
  minScore?: number
  mode?: RetrievalMode
  alpha?: number
  strictGrounding?: boolean
  systemPrompt?: string
  provider?: AIProvider
  model?: string
  temperature?: number
  timeoutMs?: number
  signal?: AbortSignal
}

export interface RAGAnswer {
  query: string
  answer: string
  citations: Citation[]
  sourcesUsed: number
  grounded: boolean
  latencyMs: number
  usage?: AIUsage
  error?: string
}
