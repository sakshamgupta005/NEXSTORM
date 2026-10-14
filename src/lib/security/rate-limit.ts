/**
 * In-Memory Sliding Window Rate Limiter
 * 
 * Capabilities:
 * - Protects API routes and Server Actions from denial of service and AI credit exhaustion
 * - Zero external dependencies (no Redis required for hackathon phase)
 * - Returns standard rate limit headers (limit, remaining, reset, retry-after)
 * - Automatic cleanup of stale client buckets
 * 
 * shortcut: In-memory sliding window is process-local and resets on serverless cold starts.
 * For production multi-region deployments, upgrade to a distributed store (Upstash/Redis).
 */

export interface RateLimitOptions {
  /** Maximum allowed requests within the window */
  limit: number
  /** Duration of window in milliseconds (default: 60,000ms = 1 minute) */
  windowMs?: number
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetMs: number
  headers: Record<string, string>
}

interface ClientBucket {
  tokens: number[]
}

class InMemoryRateLimiter {
  private buckets = new Map<string, ClientBucket>()
  private lastCleanup = Date.now()

  constructor(private defaultOptions: RateLimitOptions = { limit: 20, windowMs: 60000 }) {}

  check(identifier: string, options?: Partial<RateLimitOptions>): RateLimitResult {
    const limit = options?.limit ?? this.defaultOptions.limit
    const windowMs = options?.windowMs ?? this.defaultOptions.windowMs ?? 60000
    const now = Date.now()

    // Periodic sweep to prevent memory leak
    if (now - this.lastCleanup > 60000) {
      this.cleanup(windowMs)
      this.lastCleanup = now
    }

    let bucket = this.buckets.get(identifier)
    if (!bucket) {
      bucket = { tokens: [] }
      this.buckets.set(identifier, bucket)
    }

    // Retain only timestamps within the current window
    bucket.tokens = bucket.tokens.filter((ts) => now - ts < windowMs)

    const oldestTimestamp = bucket.tokens[0] ?? now
    const resetMs = Math.max(0, windowMs - (now - oldestTimestamp))

    if (bucket.tokens.length >= limit) {
      return {
        success: false,
        limit,
        remaining: 0,
        resetMs,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil((now + resetMs) / 1000)),
          'Retry-After': String(Math.ceil(resetMs / 1000)),
        },
      }
    }

    bucket.tokens.push(now)
    const remaining = limit - bucket.tokens.length

    return {
      success: true,
      limit,
      remaining,
      resetMs,
      headers: {
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(Math.ceil((now + resetMs) / 1000)),
      },
    }
  }

  reset(identifier: string): void {
    this.buckets.delete(identifier)
  }

  private cleanup(windowMs: number): void {
    const now = Date.now()
    for (const [key, bucket] of this.buckets.entries()) {
      bucket.tokens = bucket.tokens.filter((ts) => now - ts < windowMs)
      if (bucket.tokens.length === 0) {
        this.buckets.delete(key)
      }
    }
  }
}

// Global default singleton for convenience
export const rateLimiter = new InMemoryRateLimiter()

export function checkRateLimit(
  identifier: string,
  options?: Partial<RateLimitOptions>
): RateLimitResult {
  return rateLimiter.check(identifier, options)
}

/**
 * Extracts a client IP from common proxy headers (x-forwarded-for, cf-connecting-ip, x-real-ip).
 */
export function getClientIp(input: Request | Headers): string {
  const headers = input instanceof Request ? input.headers : input
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }

  const cfIp = headers.get('cf-connecting-ip')
  if (cfIp) return cfIp.trim()

  const realIp = headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  return '127.0.0.1'
}
