import { ICache, CacheStats } from './types';
import { InMemoryCache, NamespacedCache } from './in-memory';

export interface RedisCacheConfig {
  restUrl?: string;
  restToken?: string;
  fallbackToMemory?: boolean;
}

/**
 * Optional Redis Cache adapter supporting HTTP/REST Redis endpoints (e.g., Upstash Redis, Redis Cloud REST).
 * Operates zero-dependency via standard `fetch`.
 * Automatically falls back to resilient `InMemoryCache` when Redis is unavailable or unconfigured.
 */
export class RedisCacheAdapter implements ICache {
  readonly providerName = 'redis';
  private restUrl?: string;
  private restToken?: string;
  private fallback: InMemoryCache;
  private fallbackEnabled: boolean;

  constructor(config?: RedisCacheConfig) {
    this.restUrl = config?.restUrl || process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_REST_URL;
    this.restToken = config?.restToken || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_REST_TOKEN;
    this.fallbackEnabled = config?.fallbackToMemory !== false;
    this.fallback = new InMemoryCache();
  }

  private isConfigured(): boolean {
    return Boolean(this.restUrl && this.restToken);
  }

  private async executeCommand<T = unknown>(command: string[]): Promise<T | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const response = await fetch(`${this.restUrl}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.restToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return (data.result ?? null) as T;
    } catch {
      return null;
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    if (!this.isConfigured()) {
      return this.fallbackEnabled ? this.fallback.get<T>(key) : null;
    }

    try {
      const raw = await this.executeCommand<string>(['GET', key]);
      if (raw === null || raw === undefined) {
        return this.fallbackEnabled ? this.fallback.get<T>(key) : null;
      }
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    } catch {
      return this.fallbackEnabled ? this.fallback.get<T>(key) : null;
    }
  }

  async set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!this.isConfigured()) {
      if (this.fallbackEnabled) {
        await this.fallback.set(key, value, ttlSeconds);
      }
      return;
    }

    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.executeCommand(['SETEX', key, String(Math.floor(ttlSeconds)), serialized]);
      } else {
        await this.executeCommand(['SET', key, serialized]);
      }
    } catch {
      if (this.fallbackEnabled) {
        await this.fallback.set(key, value, ttlSeconds);
      }
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return this.fallbackEnabled ? this.fallback.delete(key) : false;
    }

    try {
      const result = await this.executeCommand<number>(['DEL', key]);
      return (result ?? 0) > 0;
    } catch {
      return this.fallbackEnabled ? this.fallback.delete(key) : false;
    }
  }

  async has(key: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return this.fallbackEnabled ? this.fallback.has(key) : false;
    }

    try {
      const result = await this.executeCommand<number>(['EXISTS', key]);
      return (result ?? 0) > 0;
    } catch {
      return this.fallbackEnabled ? this.fallback.has(key) : false;
    }
  }

  async clear(): Promise<void> {
    if (!this.isConfigured()) {
      if (this.fallbackEnabled) await this.fallback.clear();
      return;
    }

    try {
      await this.executeCommand(['FLUSHDB']);
    } catch {
      if (this.fallbackEnabled) await this.fallback.clear();
    }
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
      // Safe fallback
    }

    const value = await factory();

    try {
      await this.set(key, value, ttlSeconds);
    } catch {
      // Safe fallback
    }

    return value;
  }

  namespace(prefix: string): ICache {
    return new NamespacedCache(this, prefix);
  }

  async getStats(): Promise<CacheStats> {
    if (!this.isConfigured() && this.fallbackEnabled) {
      return this.fallback.getStats();
    }
    return { hits: 0, misses: 0, keysCount: 0 };
  }
}
