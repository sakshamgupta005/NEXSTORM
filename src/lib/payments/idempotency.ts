import { IIdempotencyStore } from './types';

interface IdempotencyRecord {
  processedAt: number;
  expiresAt: number;
}

/**
 * In-Memory Idempotency Store.
 * Tracks processed event IDs to prevent duplicate webhook delivery from repeating side-effects.
 * Completely offline, zero-dependency, and safe for development and tests.
 */
export class InMemoryIdempotencyStore implements IIdempotencyStore {
  private records = new Map<string, IdempotencyRecord>();
  private defaultTtlMs: number;

  constructor(options?: { defaultTtlSeconds?: number }) {
    this.defaultTtlMs = (options?.defaultTtlSeconds ?? 86_400) * 1000; // 24 hours default
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      if (now > record.expiresAt) {
        this.records.delete(key);
      }
    }
  }

  async has(eventId: string): Promise<boolean> {
    if (!eventId) return false;
    this.cleanupExpired();
    return this.records.has(eventId);
  }

  async markProcessed(eventId: string, ttlSeconds?: number): Promise<void> {
    if (!eventId) return;
    this.cleanupExpired();
    const now = Date.now();
    const ttlMs = ttlSeconds !== undefined ? ttlSeconds * 1000 : this.defaultTtlMs;

    this.records.set(eventId, {
      processedAt: now,
      expiresAt: now + ttlMs,
    });
  }

  async clear(): Promise<void> {
    this.records.clear();
  }

  get size(): number {
    this.cleanupExpired();
    return this.records.size;
  }
}

export const sharedIdempotencyStore = new InMemoryIdempotencyStore();
