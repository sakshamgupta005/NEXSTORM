/**
 * Offline Action Queue with Idempotency Protection and Auto-Sync.
 */

import { OfflineAction } from './types'
import { offlineStorage } from './indexed-db'

const QUEUE_STORE = 'offline_actions'

export type QueueSubscriber = (items: OfflineAction[]) => void

export class OfflineQueueManager {
  private subscribers = new Set<QueueSubscriber>()
  private isSyncing = false
  private storage: typeof offlineStorage
  private autoSync: boolean

  constructor(
    storage = offlineStorage,
    options: { autoSync?: boolean } = { autoSync: true }
  ) {
    this.storage = storage
    this.autoSync = options.autoSync ?? true

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.processQueue().catch(() => {})
      })
    }
  }

  public subscribe(callback: QueueSubscriber): () => void {
    this.subscribers.add(callback)
    this.getQueue().then((items) => callback(items)).catch(() => {})
    return () => {
      this.subscribers.delete(callback)
    }
  }

  private async notify(): Promise<void> {
    const items = await this.getQueue()
    this.subscribers.forEach((cb) => cb(items))
  }

  public async getQueue(): Promise<OfflineAction[]> {
    return this.storage.getAll<OfflineAction>(QUEUE_STORE)
  }

  public async enqueue<T = unknown>(
    action: {
      url: string
      method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
      body?: T
      headers?: Record<string, string>
      idempotencyKey?: string
      maxRetries?: number
    },
    options?: { autoSync?: boolean }
  ): Promise<OfflineAction<T>> {
    const id = `action_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const idempotencyKey =
      action.idempotencyKey ||
      `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    const newAction: OfflineAction<T> = {
      id,
      url: action.url,
      method: action.method || 'POST',
      body: action.body,
      headers: action.headers || {},
      idempotencyKey,
      createdAt: Date.now(),
      attempts: 0,
      maxRetries: action.maxRetries ?? 3,
      status: 'pending',
    }

    await this.storage.set(id, newAction, QUEUE_STORE)
    await this.notify()

    const shouldSync = options?.autoSync ?? this.autoSync
    // Trigger sync immediately if browser is currently online and autoSync is enabled
    if (shouldSync && typeof navigator !== 'undefined' && navigator.onLine) {
      this.processQueue().catch(() => {})
    }

    return newAction
  }

  public async processQueue(): Promise<{
    processed: number
    succeeded: number
    failed: number
  }> {
    if (this.isSyncing) {
      return { processed: 0, succeeded: 0, failed: 0 }
    }

    this.isSyncing = true
    let succeeded = 0
    let failed = 0
    let processed = 0

    try {
      const items = await this.getQueue()
      const pendingItems = items.filter((i) => i.status === 'pending' || i.status === 'failed')

      for (const item of pendingItems) {
        if (item.attempts >= item.maxRetries) {
          continue
        }

        processed++
        item.status = 'syncing'
        item.attempts++
        await this.storage.set(item.id, item, QUEUE_STORE)
        await this.notify()

        try {
          const res = await fetch(item.url, {
            method: item.method,
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': item.idempotencyKey,
              ...item.headers,
            },
            body: item.body ? JSON.stringify(item.body) : undefined,
          })

          if (res.ok) {
            item.status = 'synced'
            succeeded++
            // Remove from queue on success
            await this.storage.delete(item.id, QUEUE_STORE)
          } else {
            item.status = 'failed'
            item.error = `HTTP ${res.status}: ${res.statusText}`
            failed++
            await this.storage.set(item.id, item, QUEUE_STORE)
          }
        } catch (err) {
          item.status = 'failed'
          item.error = err instanceof Error ? err.message : String(err)
          failed++
          await this.storage.set(item.id, item, QUEUE_STORE)
        }
      }
    } finally {
      this.isSyncing = false
      await this.notify()
    }

    return { processed, succeeded, failed }
  }

  public async clearQueue(): Promise<void> {
    await this.storage.clear(QUEUE_STORE)
    await this.notify()
  }
}

export const offlineQueueManager = new OfflineQueueManager()
