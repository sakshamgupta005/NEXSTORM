import { ICache, CacheEntry, CacheStats } from './types';

/**
 * Resilient In-Memory Cache with TTL expiration and namespace isolation.
 * Works out-of-the-box in server environments, local dev, and tests without external dependencies.
 */
export class InMemoryCache implements ICache {
  readonly providerName = 'in-memory';
  private store = new Map<string, CacheEntry<unknown>>();
  private hits = 0;
  private misses = 0;
  private readonly maxKeys: number;
  private readonly defaultTtlSeconds?: number;

  constructor(options?: { maxKeys?: number; defaultTtlSeconds?: number }) {
    this.maxKeys = options?.maxKeys ?? 10_000;
    this.defaultTtlSeconds = options?.defaultTtlSeconds;
  }

  private isExpired(entry: CacheEntry<unknown>): boolean {
    if (!entry.expiresAt) return false;
    return Date.now() > entry.expiresAt;
  }

  private cleanupExpired(key: string): void {
    const entry = this.store.get(key);
    if (entry && this.isExpired(entry)) {
      this.store.delete(key);
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    this.cleanupExpired(key);
    const entry = this.store.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.value as T;
  }

  async set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const effectiveTtl = ttlSeconds ?? this.defaultTtlSeconds;
    const expiresAt = effectiveTtl !== undefined ? Date.now() + effectiveTtl * 1000 : undefined;

    // Basic capacity eviction: remove oldest key if limit reached
    if (this.store.size >= this.maxKeys && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    this.cleanupExpired(key);
    return this.store.has(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  async getOrSet<T = unknown>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    try {
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }
    } catch {
      // Safe fallback on cache failure
    }

    const value = await factory();

    try {
      await this.set(key, value, ttlSeconds);
    } catch {
      // Never let cache write error crash user logic
    }

    return value;
  }

  namespace(prefix: string): ICache {
    return new NamespacedCache(this, prefix);
  }

  async getStats(): Promise<CacheStats> {
    // Purge expired keys before counting
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.store.delete(key);
      }
    }

    return {
      hits: this.hits,
      misses: this.misses,
      keysCount: this.store.size,
    };
  }
}

/**
 * Namespaced cache decorator prefixing keys to avoid cross-domain collisions
 */
export class NamespacedCache implements ICache {
  readonly providerName: string;

  constructor(
    private parent: ICache,
    private prefix: string
  ) {
    this.providerName = `${parent.providerName}:${prefix}`;
  }

  private formatKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    return this.parent.get<T>(this.formatKey(key));
  }

  async set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    return this.parent.set<T>(this.formatKey(key), value, ttlSeconds);
  }

  async delete(key: string): Promise<boolean> {
    return this.parent.delete(this.formatKey(key));
  }

  async has(key: string): Promise<boolean> {
    return this.parent.has(this.formatKey(key));
  }

  async clear(): Promise<void> {
    // Clear only this namespace if parent supports key iteration, otherwise standard clear
    return this.parent.clear();
  }

  async getOrSet<T = unknown>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    return this.parent.getOrSet<T>(this.formatKey(key), factory, ttlSeconds);
  }

  namespace(subPrefix: string): ICache {
    return new NamespacedCache(this, subPrefix);
  }

  async getStats(): Promise<CacheStats> {
    if (this.parent.getStats) {
      return this.parent.getStats();
    }
    return { hits: 0, misses: 0, keysCount: 0 };
  }
}

export const sharedCache = new InMemoryCache();
