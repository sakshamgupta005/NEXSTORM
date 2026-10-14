'use client'

import { useState, useEffect, useCallback } from 'react'
import { OfflineAction } from '@/lib/pwa/types'
import { offlineQueueManager } from '@/lib/pwa/offline-queue'

export function useOfflineQueue() {
  const [queue, setQueue] = useState<OfflineAction[]>([])

  useEffect(() => {
    const unsubscribe = offlineQueueManager.subscribe((items) => {
      setQueue([...items])
    })
    return unsubscribe
  }, [])

  const enqueue = useCallback(
    async <T = unknown>(action: {
      url: string
      method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
      body?: T
      headers?: Record<string, string>
      idempotencyKey?: string
      maxRetries?: number
    }) => {
      return offlineQueueManager.enqueue(action)
    },
    []
  )

  const processQueue = useCallback(async () => {
    return offlineQueueManager.processQueue()
  }, [])

  const clearQueue = useCallback(async () => {
    return offlineQueueManager.clearQueue()
  }, [])

  const pendingCount = queue.filter(
    (item) => item.status === 'pending' || item.status === 'failed'
  ).length

  return {
    queue,
    pendingCount,
    enqueue,
    processQueue,
    clearQueue,
  }
}
