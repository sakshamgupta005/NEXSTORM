import type { DeterministicClock, HttpRouteMock } from './types'

/**
 * Deterministic Clock for reproducible time-dependent testing
 */
export function createDeterministicClock(initialTime: Date | number = 1700000000000): DeterministicClock {
  let currentTime = typeof initialTime === 'number' ? initialTime : initialTime.getTime()
  const originalDateNow = Date.now

  return {
    now(): Date {
      return new Date(currentTime)
    },
    timestamp(): number {
      return currentTime
    },
    advance(ms: number): void {
      if (ms < 0) throw new Error('Cannot advance clock backwards in time')
      currentTime += ms
    },
    set(time: Date | number): void {
      currentTime = typeof time === 'number' ? time : time.getTime()
    },
    restore(): void {
      Date.now = originalDateNow
    },
  }
}

/**
 * Mulberry32 32-bit PRNG for deterministic random values in test suites
 */
export function createDeterministicRandom(seed = 123456789): () => number {
  let s = seed >>> 0
  return function next(): number {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Generic factory builder for domain entities
 */
export function createTestFactory<T extends object>(
  defaults: T | (() => T)
): (overrides?: Partial<T>) => T {
  return (overrides?: Partial<T>): T => {
    const base = typeof defaults === 'function' ? defaults() : { ...defaults }
    return {
      ...base,
      ...overrides,
    }
  }
}

/**
 * Lightweight mock fetch interceptor (MSW-inspired pattern without heavy service worker setup)
 */
export function createMockFetch(routes: HttpRouteMock[]): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlString = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = (init?.method || 'GET').toUpperCase()

    for (const route of routes) {
      const routeMethod = (route.method || 'GET').toUpperCase()
      if (routeMethod !== method) continue

      const matches =
        typeof route.url === 'string'
          ? urlString.includes(route.url)
          : route.url.test(urlString)

      if (matches) {
        const status = route.status || 200
        const headers = new Headers({
          'content-type': 'application/json',
          ...route.headers,
        })

        let bodyData: unknown
        if (typeof route.response === 'function') {
          const req = new Request(input, init)
          bodyData = await route.response(req)
        } else {
          bodyData = route.response
        }

        const bodyString = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData)
        return new Response(bodyString, {
          status,
          headers,
        })
      }
    }

    // Default 404 response for unhandled routes in mock
    return new Response(
      JSON.stringify({ error: `MockFetch: Unhandled request to ${urlString} [${method}]` }),
      {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }
    )
  }
}

/**
 * Helper to simulate transient failures for testing retry & circuit-breaker resilience
 */
export function simulateTransientFailure<T>(
  failuresBeforeSuccess: number,
  successValue: T,
  errorFactory: (attempt: number) => Error = (attempt) => new Error(`Transient failure attempt #${attempt}`)
): () => Promise<T> {
  let attempts = 0
  return async (): Promise<T> => {
    attempts++
    if (attempts <= failuresBeforeSuccess) {
      throw errorFactory(attempts)
    }
    return successValue
  }
}
