'use client'

import * as React from 'react'

export interface UsePaginationOptions {
  initialPage?: number
  pageSize?: number
  totalItems?: number
  onPageChange?: (page: number) => void
}

export interface UsePaginationResult {
  page: number
  pageSize: number
  totalPages: number
  setPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  canNext: boolean
  canPrev: boolean
  sliceData: <T>(data: T[]) => T[]
}

/**
 * Hook for managing pagination state and slicing client-side records
 */
export function usePagination(options: UsePaginationOptions = {}): UsePaginationResult {
  const {
    initialPage = 1,
    pageSize = 10,
    totalItems = 0,
    onPageChange,
  } = options

  const [page, setPageState] = React.useState(initialPage)

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  const setPage = React.useCallback(
    (newPage: number) => {
      const clamped = Math.max(1, Math.min(newPage, totalPages))
      setPageState(clamped)
      onPageChange?.(clamped)
    },
    [totalPages, onPageChange]
  )

  const nextPage = React.useCallback(() => {
    if (page < totalPages) {
      setPage(page + 1)
    }
  }, [page, totalPages, setPage])

  const prevPage = React.useCallback(() => {
    if (page > 1) {
      setPage(page - 1)
    }
  }, [page, setPage])

  const canNext = page < totalPages
  const canPrev = page > 1

  const sliceData = React.useCallback(
    <T>(data: T[]): T[] => {
      const startIndex = (page - 1) * pageSize
      return data.slice(startIndex, startIndex + pageSize)
    },
    [page, pageSize]
  )

  return {
    page,
    pageSize,
    totalPages,
    setPage,
    nextPage,
    prevPage,
    canNext,
    canPrev,
    sliceData,
  }
}

export interface UseInfiniteQueryOptions<TItem = unknown> {
  initialPage?: number
  pageSize?: number
  onSuccess?: (items: TItem[], page: number) => void
  onError?: (error: string) => void
}

export interface InfinitePageResult<TItem = unknown> {
  items: TItem[]
  hasMore: boolean
}

export interface UseInfiniteQueryResult<TItem = unknown> {
  items: TItem[]
  page: number
  hasMore: boolean
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  loadMore: () => Promise<void>
  reset: () => void
}

/**
 * Hook for accumulated multi-page / infinite scroll data fetching
 */
export function useInfiniteQuery<TItem = unknown>(
  fetchPage: (page: number, pageSize: number) => Promise<InfinitePageResult<TItem>>,
  options: UseInfiniteQueryOptions<TItem> = {}
): UseInfiniteQueryResult<TItem> {
  const { initialPage = 1, pageSize = 10, onSuccess, onError } = options

  const [items, setItems] = React.useState<TItem[]>([])
  const [page, setPage] = React.useState<number>(initialPage)
  const [hasMore, setHasMore] = React.useState<boolean>(true)
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const [isLoadingMore, setIsLoadingMore] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)

  const fetchPageRef = React.useRef(fetchPage)
  const onSuccessRef = React.useRef(onSuccess)
  const onErrorRef = React.useRef(onError)

  React.useEffect(() => {
    fetchPageRef.current = fetchPage
    onSuccessRef.current = onSuccess
    onErrorRef.current = onError
  })

  const loadInitial = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await fetchPageRef.current(initialPage, pageSize)
      setItems(result.items)
      setHasMore(result.hasMore)
      setPage(initialPage)
      onSuccessRef.current?.(result.items, initialPage)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      onErrorRef.current?.(msg)
    } finally {
      setIsLoading(false)
    }
  }, [initialPage, pageSize])

  React.useEffect(() => {
    let isCancelled = false
    queueMicrotask(() => {
      if (!isCancelled) {
        void loadInitial()
      }
    })
    return () => {
      isCancelled = true
    }
  }, [loadInitial])

  const loadMore = React.useCallback(async () => {
    if (isLoadingMore || !hasMore || isLoading) return

    setIsLoadingMore(true)
    const nextPage = page + 1
    try {
      const result = await fetchPageRef.current(nextPage, pageSize)
      setItems((prev) => [...prev, ...result.items])
      setHasMore(result.hasMore)
      setPage(nextPage)
      onSuccessRef.current?.(result.items, nextPage)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      onErrorRef.current?.(msg)
    } finally {
      setIsLoadingMore(false)
    }
  }, [page, hasMore, isLoading, isLoadingMore, pageSize])

  const reset = React.useCallback(() => {
    setItems([])
    setPage(initialPage)
    setHasMore(true)
    loadInitial()
  }, [initialPage, loadInitial])

  return {
    items,
    page,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    loadMore,
    reset,
  }
}

/**
 * Reusable debounced value hook (for search queries, filters)
 */
export function useDebouncedValue<T>(value: T, delayMs: number = 300): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delayMs)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delayMs])

  return debouncedValue
}
