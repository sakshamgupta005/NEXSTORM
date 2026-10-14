/**
 * Reusable RAG & Document Intelligence Toolkit
 * 
 * Re-exports:
 * - Types & contracts
 * - Chunking engine (word, recursive, markdown)
 * - Embeddings (vector math, deterministic hash embedding, OpenAI adapter)
 * - In-memory vector store with hybrid retrieval
 * - Source-grounded RAG query pipeline
 */

export * from './types'
export * from './chunking'
export * from './embeddings'
export * from './store'
export * from './pipeline'
