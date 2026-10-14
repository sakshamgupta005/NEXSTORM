/**
 * Source-Grounded RAG Query Pipeline
 * 
 * Inspired by:
 * - LlamaIndex: QueryEngine & ResponseSynthesizer
 * - LangChain.js: RetrievalQA with source attribution
 * 
 * Features:
 * - Hybrid dense + sparse context retrieval
 * - Strict source grounding (prevents hallucination when context is missing)
 * - Explicit numbered source citations [1], [2] with relevance metadata
 * - Reuses core generateText AI client with mock and multi-provider fallback
 */

import { generateText } from '../ai/client'
import type { Citation, RAGAnswer, RAGPipelineOptions } from './types'
import type { InMemoryVectorStore } from './store'

const DEFAULT_SYSTEM_PROMPT = `You are a source-grounded question answering assistant.
Your task is to answer the user's question using ONLY the factual context provided in the sources below.
Rules:
1. Every factual statement or claim MUST be attributed with its source citation number, e.g. [1], [2].
2. Do not introduce outside knowledge, speculation, or hallucinated facts not supported by the sources.
3. If the provided sources do not contain sufficient evidence to answer the question, clearly state: "I cannot answer this question based on the provided documents."`

export async function queryRAG(
  query: string,
  vectorStore: InMemoryVectorStore,
  options?: RAGPipelineOptions
): Promise<RAGAnswer> {
  const startTime = Date.now()
  const trimmedQuery = query.trim()

  if (!trimmedQuery) {
    return {
      query,
      answer: 'Query cannot be empty.',
      citations: [],
      sourcesUsed: 0,
      grounded: false,
      latencyMs: 0,
      error: 'EMPTY_QUERY',
    }
  }

  // 1. Retrieve relevant chunks
  const chunks = await vectorStore.search(trimmedQuery, {
    topK: options?.topK ?? 4,
    minScore: options?.minScore ?? 0.1,
    mode: options?.mode ?? 'hybrid',
    alpha: options?.alpha ?? 0.6,
  })

  // 2. Build citations
  const citations: Citation[] = chunks.map((chunk, idx) => ({
    index: idx + 1,
    source:
      (chunk.metadata?.source as string) ||
      (chunk.metadata?.sectionHeading as string) ||
      chunk.documentId,
    documentId: chunk.documentId,
    chunkId: chunk.id,
    snippet: chunk.text.length > 160 ? `${chunk.text.slice(0, 160)}...` : chunk.text,
    score: chunk.score,
  }))

  // 3. Strict grounding check: if no chunks found
  if (citations.length === 0) {
    const latencyMs = Date.now() - startTime
    return {
      query: trimmedQuery,
      answer: 'I cannot answer this question based on the provided documents. No relevant sources were found.',
      citations: [],
      sourcesUsed: 0,
      grounded: false,
      latencyMs,
    }
  }

  // 4. Assemble context block
  const contextLines: string[] = ['Provided Source Documents:', '========================']
  citations.forEach((cit, idx) => {
    const chunk = chunks[idx]
    contextLines.push(`[${cit.index}] Source: ${cit.source} (Relevance Score: ${cit.score})`)
    contextLines.push(chunk.text)
    contextLines.push('------------------------')
  })
  const contextBlock = contextLines.join('\n')

  const prompt = `${contextBlock}\n\nUser Question: ${trimmedQuery}\n\nAnswer:`

  // 5. Query AI Client
  const aiResult = await generateText({
    prompt,
    system: options?.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    provider: options?.provider || 'mock',
    model: options?.model,
    temperature: options?.temperature ?? 0.1,
    timeoutMs: options?.timeoutMs,
  })

  const latencyMs = Date.now() - startTime

  if (!aiResult.success) {
    return {
      query: trimmedQuery,
      answer: `Failed to generate answer: ${aiResult.error || 'Unknown error'}`,
      citations,
      sourcesUsed: citations.length,
      grounded: false,
      latencyMs,
      error: aiResult.error,
    }
  }

  return {
    query: trimmedQuery,
    answer: aiResult.data ?? '',
    citations,
    sourcesUsed: citations.length,
    grounded: true,
    latencyMs,
    usage: aiResult.usage,
  }
}
