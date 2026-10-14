/**
 * Reusable Cache Layer Types & Interfaces
 */

export interface CacheEntry<T = unknown> {
  value: T;
  expiresAt?: number; // epoch ms or undefined for infinite
}

export interface CacheStats {
  hits: number;
  misses: number;
  keysCount: number;
}

export interface CacheOptions {
  ttlSeconds?: number;
  namespace?: string;
}

export interface ICache {
  readonly providerName: string;
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  getOrSet<T = unknown>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T>;
  namespace(prefix: string): ICache;
  getStats?(): Promise<CacheStats>;
}
