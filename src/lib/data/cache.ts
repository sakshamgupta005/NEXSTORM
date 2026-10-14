/**
 * Lightweight In-Memory Query & Data Cache
 * 
 * Capabilities:
 * - Time-to-Live (TTL) and stale-time freshness checking
 * - Explicit invalidation by key or key-prefix pattern
 * - Observer subscriptions for real-time cache updates
 * - Safe reset / clear helpers
 */

export interface CacheEntry<T = unknown> {
  data: T
  updatedAt: number
  ttlMs?: number
}

export type CacheListener<T = unknown> = (data: T | undefined) => void

export class QueryCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private listeners = new Map<string, Set<(data: unknown) => void>>()

  /**
   * Retrieves data from the cache if available
   */
  get<T = unknown>(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    // If entry has expired beyond TTL, purge and return undefined
    if (entry.ttlMs !== undefined && Date.now() - entry.updatedAt > entry.ttlMs) {
      this.cache.delete(key)
      this.notify(key, undefined)
      return undefined
    }

    return entry.data as T
  }

  /**
   * Gets entry metadata including timestamp
   */
  getEntry<T = unknown>(key: string): CacheEntry<T> | undefined {
    return this.cache.get(key) as CacheEntry<T> | undefined
  }

  /**
   * Checks whether the cached entry is considered fresh according to staleTimeMs
   */
  isFresh(key: string, staleTimeMs: number = 0): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    return Date.now() - entry.updatedAt <= staleTimeMs
  }

  /**
   * Writes data into the cache and notifies subscribers
   */
  set<T = unknown>(key: string, data: T, ttlMs?: number): void {
    const entry: CacheEntry<T> = {
      data,
      updatedAt: Date.now(),
      ttlMs,
    }
    this.cache.set(key, entry)
    this.notify(key, data)
  }

  /**
   * Invalidates a specific key or keys matching a prefix/regex pattern
   */
  invalidate(keyOrPattern: string): void {
    const keysToDelete: string[] = []
    for (const key of this.cache.keys()) {
      if (key === keyOrPattern || key.startsWith(`${keyOrPattern}:`) || key.startsWith(`${keyOrPattern}/`)) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key)
      this.notify(key, undefined)
    }
  }

  /**
   * Clears the entire cache
   */
  clear(): void {
    const allKeys = Array.from(this.cache.keys())
    this.cache.clear()
    for (const key of allKeys) {
      this.notify(key, undefined)
    }
  }

  /**
   * Subscribes to changes for a specific cache key
   */
  subscribe<T = unknown>(key: string, listener: CacheListener<T>): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set())
    }
    const set = this.listeners.get(key)!
    const rawListener = listener as (data: unknown) => void
    set.add(rawListener)

    return () => {
      set.delete(rawListener)
      if (set.size === 0) {
        this.listeners.delete(key)
      }
    }
  }

  private notify(key: string, data: unknown): void {
    const set = this.listeners.get(key)
    if (set) {
      for (const listener of set) {
        try {
          listener(data)
        } catch {
          // ignore subscriber errors
        }
      }
    }
  }
}

export const queryCache = new QueryCache()
