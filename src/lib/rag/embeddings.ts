/**
 * Embedding Utilities & Vector Math
 * 
 * Provides:
 * - Cosine similarity, dot product, and vector normalization
 * - Deterministic hash-based embedding generator for 100% offline testing
 * - Optional OpenAI text-embedding-3 adapter using native fetch
 */

import { isValidEnvValue } from '../env'

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>
  embedBatch(texts: string[]): Promise<number[][]>
  dimensions: number
}

export function dotProduct(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length)
  let sum = 0
  for (let i = 0; i < len; i++) {
    sum += a[i] * b[i]
  }
  return sum
}

export function magnitude(a: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * a[i]
  }
  return Math.sqrt(sum)
}

export function normalizeVector(v: number[]): number[] {
  const mag = magnitude(v)
  if (mag === 0) return v.slice()
  return v.map((x) => x / mag)
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const magA = magnitude(a)
  const magB = magnitude(b)
  if (magA === 0 || magB === 0) return 0
  const dot = dotProduct(a, b)
  const score = dot / (magA * magB)
  return Math.max(-1, Math.min(1, score))
}

/**
 * Deterministic hash-based embedding generator.
 * Produces unit-normalized 64-dimensional float vectors from text character and word n-grams.
 * Guaranteed to return identical vectors for identical text without network or model overhead.
 */
export class DeterministicHashEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions: number

  constructor(dimensions = 64) {
    this.dimensions = dimensions
  }

  async embed(text: string): Promise<number[]> {
    const vector = new Array<number>(this.dimensions).fill(0)
    const normalized = text.toLowerCase().trim()
    if (!normalized) return vector

    // 1. Character n-grams (3-grams)
    for (let i = 0; i < normalized.length - 2; i++) {
      const code =
        normalized.charCodeAt(i) * 31 +
        normalized.charCodeAt(i + 1) * 17 +
        normalized.charCodeAt(i + 2)
      const slot = Math.abs(code) % this.dimensions
      vector[slot] += 1
    }

    // 2. Word tokens
    const words = normalized.split(/\W+/).filter((w) => w.length > 2)
    for (const word of words) {
      let hash = 5381
      for (let i = 0; i < word.length; i++) {
        hash = (hash * 33) ^ word.charCodeAt(i)
      }
      const slot = Math.abs(hash) % this.dimensions
      vector[slot] += 2.5
    }

    return normalizeVector(vector)
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const promises = texts.map((t) => this.embed(t))
    return Promise.all(promises)
  }
}

/**
 * OpenAI Embeddings Adapter (text-embedding-3-small by default)
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions: number
  private apiKey?: string
  private model: string

  constructor(options?: { apiKey?: string; model?: string; dimensions?: number }) {
    this.apiKey = options?.apiKey || process.env.OPENAI_API_KEY
    this.model = options?.model || 'text-embedding-3-small'
    this.dimensions = options?.dimensions || 1536
  }

  async embed(text: string): Promise<number[]> {
    const [vec] = await this.embedBatch([text])
    return vec
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!isValidEnvValue(this.apiKey)) {
      throw new Error('OpenAIEmbeddingProvider requires a valid OPENAI_API_KEY')
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    })

    if (!response.ok) {
      const err = await response.text().catch(() => '')
      throw new Error(`OpenAI embeddings request failed (${response.status}): ${err}`)
    }

    const data = await response.json()
    return (data.data || []).map((item: { embedding: number[] }) => item.embedding)
  }
}

export function createEmbeddingProvider(provider?: 'mock' | 'openai'): EmbeddingProvider {
  if (provider === 'openai' && isValidEnvValue(process.env.OPENAI_API_KEY)) {
    return new OpenAIEmbeddingProvider()
  }
  return new DeterministicHashEmbeddingProvider()
}
