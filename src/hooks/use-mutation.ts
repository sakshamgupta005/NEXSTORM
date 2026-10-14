'use client'

import * as React from 'react'
import { queryCache } from '@/lib/data/cache'

export interface UseMutationOptions<TData = unknown, TVariables = unknown, TContext = unknown> {
  onMutate?: (variables: TVariables) => Promise<TContext | undefined> | TContext | undefined
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void
  onError?: (error: string, variables: TVariables, context: TContext | undefined) => void
  onSettled?: (data: TData | undefined, error: string | null, variables: TVariables, context: TContext | undefined) => void
  invalidateKeys?: string[]
}

export interface UseMutationResult<TData = unknown, TVariables = unknown> {
  mutate: (variables: TVariables) => Promise<TData | undefined>
  mutateAsync: (variables: TVariables) => Promise<TData>
  data: TData | undefined
  error: string | null
  isPending: boolean
  isSuccess: boolean
  isError: boolean
  reset: () => void
}

export function useMutation<TData = unknown, TVariables = unknown, TContext = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseMutationOptions<TData, TVariables, TContext> = {}
): UseMutationResult<TData, TVariables> {
  const { onMutate, onSuccess, onError, onSettled, invalidateKeys } = options

  const [data, setData] = React.useState<TData | undefined>(undefined)
  const [error, setError] = React.useState<string | null>(null)
  const [isPending, setIsPending] = React.useState<boolean>(false)
  const [isSuccess, setIsSuccess] = React.useState<boolean>(false)
  const [isError, setIsError] = React.useState<boolean>(false)

  const mutationFnRef = React.useRef(mutationFn)
  const onMutateRef = React.useRef(onMutate)
  const onSuccessRef = React.useRef(onSuccess)
  const onErrorRef = React.useRef(onError)
  const onSettledRef = React.useRef(onSettled)

  React.useEffect(() => {
    mutationFnRef.current = mutationFn
    onMutateRef.current = onMutate
    onSuccessRef.current = onSuccess
    onErrorRef.current = onError
    onSettledRef.current = onSettled
  })

  const mutateAsync = React.useCallback(
    async (variables: TVariables): Promise<TData> => {
      setIsPending(true)
      setError(null)
      setIsError(false)
      setIsSuccess(false)

      let context: TContext | undefined = undefined

      // Optimistic update via onMutate
      if (onMutateRef.current) {
        try {
          context = await onMutateRef.current(variables)
        } catch {
          // If onMutate throws, continue execution safely
        }
      }

      try {
        const result = await mutationFnRef.current(variables)

        setData(result)
        setIsSuccess(true)
        setIsPending(false)

        // Automatic cache invalidation
        if (invalidateKeys && invalidateKeys.length > 0) {
          for (const key of invalidateKeys) {
            queryCache.invalidate(key)
          }
        }

        onSuccessRef.current?.(result, variables, context)
        onSettledRef.current?.(result, null, variables, context)
        return result
      } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : String(err)
        setError(errMessage)
        setIsError(true)
        setIsPending(false)

        // Trigger onError with rollback context
        onErrorRef.current?.(errMessage, variables, context)
        onSettledRef.current?.(undefined, errMessage, variables, context)
        throw err
      }
    },
    [invalidateKeys]
  )

  const mutate = React.useCallback(
    async (variables: TVariables): Promise<TData | undefined> => {
      try {
        return await mutateAsync(variables)
      } catch {
        return undefined
      }
    },
    [mutateAsync]
  )

  const reset = React.useCallback(() => {
    setData(undefined)
    setError(null)
    setIsPending(false)
    setIsSuccess(false)
    setIsError(false)
  }, [])

  return {
    mutate,
    mutateAsync,
    data,
    error,
    isPending,
    isSuccess,
    isError,
    reset,
  }
}
