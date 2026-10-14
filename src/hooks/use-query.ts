'use client'

import * as React from 'react'
import { queryCache } from '@/lib/data/cache'

export interface UseQueryOptions<T = unknown> {
  enabled?: boolean
  initialData?: T
  staleTime?: number
  ttl?: number
  retry?: number
  retryDelayMs?: number
  onSuccess?: (data: T) => void
  onError?: (error: string) => void
}

export interface UseQueryResult<T = unknown> {
  data: T | undefined
  error: string | null
  isLoading: boolean
  isFetching: boolean
  isSuccess: boolean
  isError: boolean
  isEmpty: boolean
  refetch: () => Promise<T | undefined>
  setData: (updater: T | ((prev: T | undefined) => T)) => void
}

export function useQuery<T = unknown>(
  key: string | null | undefined,
  fetcher: (signal?: AbortSignal) => Promise<T>,
  options: UseQueryOptions<T> = {}
): UseQueryResult<T> {
  const {
    enabled = true,
    initialData,
    staleTime = 0,
    ttl,
    retry = 0,
    retryDelayMs = 250,
    onSuccess,
    onError,
  } = options

  // Read initial cached data synchronously if available
  const cachedData = key ? queryCache.get<T>(key) : undefined
  const startingData = cachedData !== undefined ? cachedData : initialData

  const [data, setInternalData] = React.useState<T | undefined>(startingData)
  const [error, setError] = React.useState<string | null>(null)
  const [isFetching, setIsFetching] = React.useState<boolean>(false)
  const [isInitialized, setIsInitialized] = React.useState<boolean>(startingData !== undefined)

  // Track sequence ID to prevent out-of-order stale responses
  const requestSeqRef = React.useRef(0)
  const abortControllerRef = React.useRef<AbortController | null>(null)
  const fetcherRef = React.useRef(fetcher)
  const onSuccessRef = React.useRef(onSuccess)
  const onErrorRef = React.useRef(onError)

  React.useEffect(() => {
    fetcherRef.current = fetcher
    onSuccessRef.current = onSuccess
    onErrorRef.current = onError
  })

  const executeFetch = React.useCallback(
    async (isManualRefetch = false): Promise<T | undefined> => {
      if (!key || (!enabled && !isManualRefetch)) {
        return undefined
      }

      // Check cache freshness unless manual refetch is requested
      if (!isManualRefetch && queryCache.isFresh(key, staleTime)) {
        const fresh = queryCache.get<T>(key)
        if (fresh !== undefined) {
          setInternalData(fresh)
          setError(null)
          setIsInitialized(true)
          return fresh
        }
      }

      // Cancel any ongoing fetch for this hook
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      const controller = new AbortController()
      abortControllerRef.current = controller

      const currentSeq = ++requestSeqRef.current
      setIsFetching(true)

      let attempts = 0
      let lastErr: Error | null = null

      while (attempts <= retry) {
        attempts++
        try {
          const result = await fetcherRef.current(controller.signal)

          // Discard if a newer request has started or signal was aborted
          if (currentSeq !== requestSeqRef.current || controller.signal.aborted) {
            return undefined
          }

          // Cache update & state synchronization
          queryCache.set(key, result, ttl)
          setInternalData(result)
          setError(null)
          setIsInitialized(true)
          setIsFetching(false)

          onSuccessRef.current?.(result)
          return result
        } catch (err: unknown) {
          if (controller.signal.aborted || currentSeq !== requestSeqRef.current) {
            return undefined
          }

          lastErr = err instanceof Error ? err : new Error(String(err))

          if (attempts <= retry) {
            await new Promise((res) => setTimeout(res, retryDelayMs * attempts))
            continue
          }

          // Failed after all retries
          const errorMessage = lastErr.message || 'Failed to fetch data'
          setError(errorMessage)
          setIsInitialized(true)
          setIsFetching(false)

          onErrorRef.current?.(errorMessage)
          return undefined
        }
      }

      return undefined
    },
    [key, enabled, staleTime, ttl, retry, retryDelayMs]
  )

  // Effect: trigger fetch asynchronously or revalidate when key/enabled changes
  React.useEffect(() => {
    let isCancelled = false

    // Defer initial execution out of the synchronous render/effect execution phase
    queueMicrotask(() => {
      if (!isCancelled) {
        void executeFetch(false)
      }
    })

    // Subscribe to external cache updates or invalidations
    if (key) {
      const unsubscribe = queryCache.subscribe<T>(key, (updatedData) => {
        if (!isCancelled) {
          if (updatedData === undefined) {
            // Key was invalidated, trigger a refetch
            void executeFetch(true)
          } else {
            setInternalData(updatedData)
            setError(null)
          }
        }
      })
      return () => {
        isCancelled = true
        unsubscribe()
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }
      }
    }

    return () => {
      isCancelled = true
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [key, executeFetch])

  const setData = React.useCallback(
    (updater: T | ((prev: T | undefined) => T)) => {
      setInternalData((prev) => {
        const next = typeof updater === 'function' ? (updater as (p: T | undefined) => T)(prev) : updater
        if (key) {
          queryCache.set(key, next, ttl)
        }
        return next
      })
    },
    [key, ttl]
  )

  const isLoading = !isInitialized && isFetching
  const isSuccess = isInitialized && error === null
  const isError = error !== null

  const isEmpty =
    isSuccess &&
    (data === null ||
      data === undefined ||
      (Array.isArray(data) && data.length === 0) ||
      (typeof data === 'string' && data.trim() === ''))

  return {
    data,
    error,
    isLoading,
    isFetching,
    isSuccess,
    isError,
    isEmpty,
    refetch: () => executeFetch(true),
    setData,
  }
}
