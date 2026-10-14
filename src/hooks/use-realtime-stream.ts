'use client'

import * as React from 'react'
import { consumeSSE, SSEEvent } from '@/lib/realtime/sse'

export interface UseRealtimeStreamOptions {
  autoStart?: boolean
  authToken?: string
  getAuthToken?: () => string | Promise<string | null>
  onChunk?: (chunk: string) => void
  onDone?: (fullText: string) => void
  onError?: (error: string) => void
}

export interface UseRealtimeStreamResult {
  text: string
  lastEvent: SSEEvent | null
  isStreaming: boolean
  error: string | null
  start: (overrideUrl?: string) => Promise<void>
  abort: () => void
  reset: () => void
}

export function useRealtimeStream(
  url?: string | null,
  options: UseRealtimeStreamOptions = {}
): UseRealtimeStreamResult {
  const { autoStart = false, authToken, getAuthToken, onChunk, onDone, onError } = options

  const [text, setText] = React.useState<string>('')
  const [lastEvent, setLastEvent] = React.useState<SSEEvent | null>(null)
  const [isStreaming, setIsStreaming] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)

  const abortControllerRef = React.useRef<AbortController | null>(null)
  const textRef = React.useRef('')
  const onChunkRef = React.useRef(onChunk)
  const onDoneRef = React.useRef(onDone)
  const onErrorRef = React.useRef(onError)

  React.useEffect(() => {
    textRef.current = text
    onChunkRef.current = onChunk
    onDoneRef.current = onDone
    onErrorRef.current = onError
  })

  const start = React.useCallback(
    async (overrideUrl?: string): Promise<void> => {
      const targetUrl = overrideUrl ?? url
      if (!targetUrl) return

      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      const controller = new AbortController()
      abortControllerRef.current = controller

      setIsStreaming(true)
      setError(null)
      setText('')
      textRef.current = ''

      try {
        await consumeSSE(targetUrl, {
          signal: controller.signal,
          authToken,
          getAuthToken,
          onEvent: (ev) => {
            setLastEvent(ev)
          },
          onChunk: (chunk) => {
            setText((prev) => {
              const updated = prev + chunk
              textRef.current = updated
              return updated
            })
            onChunkRef.current?.(chunk)
          },
          onDone: () => {
            setIsStreaming(false)
            onDoneRef.current?.(textRef.current)
          },
          onError: (err) => {
            setIsStreaming(false)
            setError(err.message)
            onErrorRef.current?.(err.message)
          },
        })
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          const msg = err instanceof Error ? err.message : String(err)
          setError(msg)
          setIsStreaming(false)
          onErrorRef.current?.(msg)
        }
      } finally {
        if (abortControllerRef.current === controller) {
          setIsStreaming(false)
        }
      }
    },
    [url, authToken, getAuthToken]
  )

  const abort = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsStreaming(false)
    }
  }, [])

  const reset = React.useCallback(() => {
    abort()
    setText('')
    setLastEvent(null)
    setError(null)
  }, [abort])

  React.useEffect(() => {
    let isCancelled = false
    if (autoStart && url) {
      queueMicrotask(() => {
        if (!isCancelled) {
          void start()
        }
      })
    }

    return () => {
      isCancelled = true
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [autoStart, url, start])

  return {
    text,
    lastEvent,
    isStreaming,
    error,
    start,
    abort,
    reset,
  }
}
