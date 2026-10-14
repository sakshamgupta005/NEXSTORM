/**
 * In-Memory Search & Webpage Cache with TTL
 * 
 * Prevents redundant outbound requests, reduces API costs, and accelerates repeated queries.
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export class SearchCache {
  private store = new Map<string, CacheEntry<unknown>>()
  private maxEntries: number
  private defaultTtlMs: number

  constructor(options: { maxEntries?: number; defaultTtlMs?: number } = {}) {
    this.maxEntries = options.maxEntries ?? 500
    this.defaultTtlMs = options.defaultTtlMs ?? 10 * 60 * 1000 // 10 minutes default
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }

    return entry.value as T
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    // Evict oldest entries if capacity reached
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value
      if (oldestKey) {
        this.store.delete(oldestKey)
      }
    }

    const duration = ttlMs ?? this.defaultTtlMs
    this.store.set(key, {
      value,
      expiresAt: Date.now() + duration,
    })
  }

  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  delete(key: string): boolean {
    return this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }

  get size(): number {
    return this.store.size
  }
}

export const sharedSearchCache = new SearchCache()
