import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { safeFetch, createApiClient, buildUrl } from '@/lib/api/client'
import { QueryCache, queryCache } from '@/lib/data/cache'
import { useQuery } from '@/hooks/use-query'
import { useMutation } from '@/hooks/use-mutation'
import { usePagination, useInfiniteQuery, useDebouncedValue } from '@/hooks/use-pagination'

describe('API Client & safeFetch Enhancements', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    queryCache.clear()
  })

  it('buildUrl handles relative, absolute, and query parameters cleanly', () => {
    expect(buildUrl('/users', 'https://api.example.com')).toBe('https://api.example.com/users')
    expect(buildUrl('https://other.com/v1', 'https://api.example.com')).toBe('https://other.com/v1')
    expect(buildUrl('/search', 'https://api.example.com', { q: 'react', page: 2, empty: null })).toBe(
      'https://api.example.com/search?q=react&page=2'
    )
  })

  it('parses text and blob responseTypes correctly', async () => {
    // Text response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: async () => 'hello plain text',
    })

    const textResult = await safeFetch('https://api.example.com/text', { responseType: 'text' })
    expect(textResult.ok).toBe(true)
    expect(textResult.data).toBe('hello plain text')

    // Blob response
    const mockBlob = new Blob(['data'], { type: 'application/pdf' })
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/pdf' }),
      blob: async () => mockBlob,
    })

    const blobResult = await safeFetch('https://api.example.com/file', { responseType: 'blob' })
    expect(blobResult.ok).toBe(true)
    expect(blobResult.data).toBe(mockBlob)
  })

  it('classifies malformed JSON responses with PARSE_ERROR', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => {
        throw new Error('Unexpected token in JSON')
      },
    })

    const result = await safeFetch('https://api.example.com/bad-json', { responseType: 'json' })
    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('PARSE_ERROR')
    expect(result.error).toContain('Failed to parse response')
  })

  it('classifies user request cancellation with ABORTED without retrying', async () => {
    const controller = new AbortController()
    global.fetch = vi.fn().mockImplementation(() => {
      const err = new Error('The operation was aborted')
      err.name = 'AbortError'
      return Promise.reject(err)
    })

    controller.abort() // Cancel before / during call
    const result = await safeFetch('https://api.example.com/abort', {
      signal: controller.signal,
      retries: 2,
    })

    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('ABORTED')
    expect(result.error).toContain('cancelled by user')
    expect(result.attempts).toBe(1) // Never retries cancelled requests
  })

  it('resolves dynamic auth tokens and appends Authorization header', async () => {
    let capturedHeaders: Headers | undefined
    global.fetch = vi.fn().mockImplementation((_url, init) => {
      capturedHeaders = init.headers as Headers
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ user: 'auth-user' }),
      })
    })

    const client = createApiClient({
      baseUrl: 'https://api.example.com',
      getAuthToken: async () => 'secret_jwt_token_123',
    })

    const result = await client.get('/me')
    expect(result.ok).toBe(true)
    expect(capturedHeaders?.get('authorization')).toBe('Bearer secret_jwt_token_123')
  })

  it('deduplicates in-flight identical GET requests', async () => {
    let fetchCalls = 0
    global.fetch = vi.fn().mockImplementation(async () => {
      fetchCalls++
      await new Promise((res) => setTimeout(res, 30))
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ count: fetchCalls }),
      }
    })

    // Fire 3 simultaneous GET calls with deduplicate: true
    const [res1, res2, res3] = await Promise.all([
      safeFetch('https://api.example.com/items', { deduplicate: true }),
      safeFetch('https://api.example.com/items', { deduplicate: true }),
      safeFetch('https://api.example.com/items', { deduplicate: true }),
    ])

    expect(fetchCalls).toBe(1)
    expect(res1.data).toEqual({ count: 1 })
    expect(res2.data).toEqual({ count: 1 })
    expect(res3.data).toEqual({ count: 1 })
  })

  it('parses 429 Retry-After header properly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: new Headers({ 'retry-after': '60' }),
      text: async () => 'Rate limit exceeded',
    })

    const result = await safeFetch('https://api.example.com/burst', { retries: 0 })
    expect(result.ok).toBe(false)
    expect(result.status).toBe(429)
    expect(result.retryAfter).toBe(60)
  })
})

describe('QueryCache In-Memory Cache', () => {
  let cache: QueryCache

  beforeEach(() => {
    cache = new QueryCache()
  })

  it('stores and retrieves items within TTL', () => {
    cache.set('key-1', { name: 'Alice' }, 1000)
    expect(cache.get('key-1')).toEqual({ name: 'Alice' })
    expect(cache.isFresh('key-1', 5000)).toBe(true)
  })

  it('expires and deletes items beyond TTL', () => {
    const expiredEntry = {
      data: { name: 'Bob' },
      updatedAt: Date.now() - 2000,
      ttlMs: 1000,
    }
    // Inject expired entry
    ;(cache as unknown as { cache: Map<string, unknown> }).cache.set('key-expired', expiredEntry)
    expect(cache.get('key-expired')).toBeUndefined()
  })

  it('invalidates exact keys and prefix patterns', () => {
    cache.set('users', ['all'])
    cache.set('users:1', { id: 1 })
    cache.set('users:2', { id: 2 })
    cache.set('posts:1', { id: 10 })

    cache.invalidate('users')

    expect(cache.get('users')).toBeUndefined()
    expect(cache.get('users:1')).toBeUndefined()
    expect(cache.get('users:2')).toBeUndefined()
    expect(cache.get('posts:1')).toEqual({ id: 10 })
  })
})

describe('useQuery Hook', () => {
  beforeEach(() => {
    queryCache.clear()
    vi.restoreAllMocks()
  })

  it('manages loading, success, and data states', async () => {
    const fetcher = vi.fn().mockResolvedValue(['doc1', 'doc2'])

    const { result } = renderHook(() =>
      useQuery('test-docs', fetcher)
    )

    expect(result.current.data).toBeUndefined()

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(['doc1', 'doc2'])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isEmpty).toBe(false)
  })

  it('identifies isEmpty state on empty arrays or empty strings', async () => {
    const fetcher = vi.fn().mockResolvedValue([])

    const { result } = renderHook(() =>
      useQuery('empty-list', fetcher)
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.isEmpty).toBe(true)
  })

  it('manages error states on fetch rejection', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Network offline'))

    const { result } = renderHook(() =>
      useQuery('failed-query', fetcher, { retry: 0 })
    )

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBe('Network offline')
  })

  it('discards stale out-of-order responses using request sequence protection', async () => {
    let callIndex = 0
    // Request 1 takes 80ms, Request 2 takes 10ms
    const fetcher = vi.fn().mockImplementation(() => {
      callIndex++
      const idx = callIndex
      return new Promise((resolve) => {
        const delay = idx === 1 ? 80 : 10
        setTimeout(() => resolve(`response-${idx}`), delay)
      })
    })

    const { result } = renderHook(() =>
      useQuery('race-key', fetcher)
    )

    // Trigger second request before first finishes
    await act(async () => {
      void result.current.refetch()
    })

    await waitFor(() => {
      expect(result.current.data).toBe('response-2')
    })

    // Wait past the first request's delay to ensure it didn't overwrite response-2
    await new Promise((res) => setTimeout(res, 100))
    expect(result.current.data).toBe('response-2')
  })

  it('updates data locally using setData', async () => {
    const fetcher = vi.fn().mockResolvedValue({ count: 5 })

    const { result } = renderHook(() =>
      useQuery('counter', fetcher)
    )

    await waitFor(() => {
      expect(result.current.data).toEqual({ count: 5 })
    })

    act(() => {
      result.current.setData({ count: 10 })
    })

    expect(result.current.data).toEqual({ count: 10 })
  })
})

describe('useMutation Hook', () => {
  beforeEach(() => {
    queryCache.clear()
    vi.restoreAllMocks()
  })

  it('executes mutation successfully and triggers onSuccess', async () => {
    const onSuccess = vi.fn()
    const mutationFn = vi.fn().mockResolvedValue({ id: 101, title: 'Created' })

    const { result } = renderHook(() =>
      useMutation(mutationFn, { onSuccess })
    )

    let mutateResult: { id: number; title: string } | undefined
    await act(async () => {
      mutateResult = await result.current.mutate({ title: 'Created' })
    })

    expect(mutateResult).toEqual({ id: 101, title: 'Created' })
    expect(result.current.isSuccess).toBe(true)
    expect(onSuccess).toHaveBeenCalledWith(
      { id: 101, title: 'Created' },
      { title: 'Created' },
      undefined
    )
  })

  it('supports optimistic update and executes rollback on mutation failure', async () => {
    let currentStore = ['item1', 'item2']

    const onMutate = vi.fn().mockImplementation((newItem: string) => {
      const rollbackSnapshot = [...currentStore]
      currentStore = [...currentStore, newItem]
      return { rollbackSnapshot }
    })

    const onError = vi.fn().mockImplementation((_err, _vars, context) => {
      if (context?.rollbackSnapshot) {
        currentStore = context.rollbackSnapshot
      }
    })

    const mutationFn = vi.fn().mockRejectedValue(new Error('Server write rejected'))

    const { result } = renderHook(() =>
      useMutation(mutationFn, { onMutate, onError })
    )

    await act(async () => {
      await result.current.mutate('item3')
    })

    expect(result.current.isError).toBe(true)
    expect(result.current.error).toBe('Server write rejected')
    // Successfully rolled back to snapshot!
    expect(currentStore).toEqual(['item1', 'item2'])
  })

  it('automatically invalidates cache keys on successful mutation', async () => {
    queryCache.set('projects', ['p1', 'p2'])

    const mutationFn = vi.fn().mockResolvedValue({ id: 'p3' })

    const { result } = renderHook(() =>
      useMutation(mutationFn, { invalidateKeys: ['projects'] })
    )

    await act(async () => {
      await result.current.mutate({ name: 'p3' })
    })

    expect(queryCache.get('projects')).toBeUndefined()
  })
})

describe('usePagination, useInfiniteQuery, and useDebouncedValue Hooks', () => {
  it('usePagination manages page clamping, canNext, canPrev, and data slicing', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

    const { result } = renderHook(() =>
      usePagination({ initialPage: 1, pageSize: 5, totalItems: 12 })
    )

    expect(result.current.page).toBe(1)
    expect(result.current.totalPages).toBe(3)
    expect(result.current.canPrev).toBe(false)
    expect(result.current.canNext).toBe(true)
    expect(result.current.sliceData(data)).toEqual([1, 2, 3, 4, 5])

    act(() => {
      result.current.nextPage()
    })

    expect(result.current.page).toBe(2)
    expect(result.current.canPrev).toBe(true)
    expect(result.current.sliceData(data)).toEqual([6, 7, 8, 9, 10])

    // Advance to last page
    act(() => {
      result.current.nextPage()
    })
    expect(result.current.page).toBe(3)
    expect(result.current.canNext).toBe(false)
    expect(result.current.sliceData(data)).toEqual([11, 12])
  })

  it('useInfiniteQuery accumulates multi-page data on loadMore', async () => {
    const fetchPage = vi.fn().mockImplementation((page: number) => {
      if (page === 1) return Promise.resolve({ items: ['a', 'b'], hasMore: true })
      if (page === 2) return Promise.resolve({ items: ['c', 'd'], hasMore: false })
      return Promise.resolve({ items: [], hasMore: false })
    })

    const { result } = renderHook(() =>
      useInfiniteQuery(fetchPage, { initialPage: 1, pageSize: 2 })
    )

    await waitFor(() => {
      expect(result.current.items).toEqual(['a', 'b'])
    })

    expect(result.current.hasMore).toBe(true)

    await act(async () => {
      await result.current.loadMore()
    })

    expect(result.current.items).toEqual(['a', 'b', 'c', 'd'])
    expect(result.current.hasMore).toBe(false)
  })

  it('useDebouncedValue delays state propagation until quiet period elapses', async () => {
    vi.useFakeTimers()

    const { result, rerender } = renderHook(
      ({ val }) => useDebouncedValue(val, 200),
      { initialProps: { val: 'initial' } }
    )

    expect(result.current).toBe('initial')

    rerender({ val: 'updated-1' })
    expect(result.current).toBe('initial') // not yet updated

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe('initial') // still within debounce window

    act(() => {
      vi.advanceTimersByTime(110)
    })
    expect(result.current).toBe('updated-1') // now updated after 200ms

    vi.useRealTimers()
  })
})
