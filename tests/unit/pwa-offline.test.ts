import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  DEFAULT_PWA_CONFIG,
  isPwaEnabled,
  isExcludedFromCache,
  OfflineStorage,
  OfflineQueueManager,
  registerServiceWorker,
  unregisterServiceWorker,
} from '@/lib/pwa'

describe('PWA & Offline Support Toolkit - Unit Tests', () => {
  const originalEnv = process.env.NEXT_PUBLIC_PWA_ENABLED

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_PWA_ENABLED = originalEnv
  })

  describe('Configuration & Cache Exclusion', () => {
    it('provides sensible default configuration', () => {
      expect(DEFAULT_PWA_CONFIG.appName).toBeDefined()
      expect(DEFAULT_PWA_CONFIG.themeColor).toBe('#2563eb')
      expect(DEFAULT_PWA_CONFIG.display).toBe('standalone')
      expect(DEFAULT_PWA_CONFIG.cacheName).toContain('pwa')
    })

    it('correctly evaluates isPwaEnabled based on environment flag', () => {
      delete process.env.NEXT_PUBLIC_PWA_ENABLED
      expect(isPwaEnabled()).toBe(false)

      process.env.NEXT_PUBLIC_PWA_ENABLED = 'true'
      expect(isPwaEnabled()).toBe(true)

      process.env.NEXT_PUBLIC_PWA_ENABLED = 'false'
      expect(isPwaEnabled()).toBe(false)
    })

    it('strictly excludes sensitive API and Auth URLs from offline cache', () => {
      expect(isExcludedFromCache('/api/v1/users')).toBe(true)
      expect(isExcludedFromCache('/auth/signout')).toBe(true)
      expect(isExcludedFromCache('https://xyz.supabase.co/rest/v1')).toBe(true)
      expect(isExcludedFromCache('/dashboard/admin/settings')).toBe(true)

      // Safe static assets and landing pages should NOT be excluded
      expect(isExcludedFromCache('/styles.css')).toBe(false)
      expect(isExcludedFromCache('/dashboard')).toBe(false)
      expect(isExcludedFromCache('/logo.png')).toBe(false)
      expect(isExcludedFromCache('')).toBe(false)
    })
  })

  describe('IndexedDB Client Storage (with SSR In-Memory Fallback)', () => {
    let storage: OfflineStorage

    beforeEach(() => {
      storage = new OfflineStorage('test_db', 1)
    })

    it('stores, retrieves, and deletes key-value pairs', async () => {
      await storage.set('user_profile', { name: 'Alice', theme: 'dark' })
      const retrieved = await storage.get<{ name: string; theme: string }>('user_profile')

      expect(retrieved).toEqual({ name: 'Alice', theme: 'dark' })

      await storage.delete('user_profile')
      const afterDelete = await storage.get('user_profile')
      expect(afterDelete).toBeUndefined()
    })

    it('retrieves all items in a store', async () => {
      await storage.set('item_1', 'value1')
      await storage.set('item_2', 'value2')

      const all = await storage.getAll<string>()
      expect(all).toContain('value1')
      expect(all).toContain('value2')
    })

    it('clears all items in a store', async () => {
      await storage.set('item_1', 'value1')
      await storage.set('item_2', 'value2')
      await storage.clear()

      const all = await storage.getAll<string>()
      expect(all).toHaveLength(0)
    })
  })

  describe('Offline Action Queue & Idempotency', () => {
    let queueManager: OfflineQueueManager

    beforeEach(() => {
      queueManager = new OfflineQueueManager()
    })

    it('enqueues an action with idempotency key and default retry parameters', async () => {
      const action = await queueManager.enqueue({
        url: '/api/v1/records',
        method: 'POST',
        body: { title: 'Offline Note' },
      })

      expect(action.id).toBeDefined()
      expect(action.idempotencyKey).toBeDefined()
      expect(action.status).toBe('pending')
      expect(action.attempts).toBe(0)
      expect(action.maxRetries).toBe(3)
    })

    it('preserves custom idempotency key if supplied', async () => {
      const customKey = 'custom-uuid-1234'
      const action = await queueManager.enqueue({
        url: '/api/v1/records',
        idempotencyKey: customKey,
      })

      expect(action.idempotencyKey).toBe(customKey)
    })

    it('notifies subscribers when actions are enqueued or cleared', async () => {
      const subscriber = vi.fn()
      const unsubscribe = queueManager.subscribe(subscriber)

      await queueManager.enqueue({ url: '/api/test' })
      expect(subscriber).toHaveBeenCalled()

      await queueManager.clearQueue()
      expect(subscriber).toHaveBeenCalled()

      unsubscribe()
    })

    it('processes queued actions and handles success and failures', async () => {
      const testStorage = new OfflineStorage('test_queue_sync_db', 1)
      const manualQueueManager = new OfflineQueueManager(testStorage, { autoSync: false })

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
      }).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Error',
      })

      global.fetch = mockFetch

      await manualQueueManager.enqueue({ url: '/api/success' })
      await manualQueueManager.enqueue({ url: '/api/failure' })

      const result = await manualQueueManager.processQueue()

      expect(result.processed).toBe(2)
      expect(result.succeeded).toBe(1)
      expect(result.failed).toBe(1)
    })
  })

  describe('Service Worker Lifecycle Management', () => {
    it('returns disabled status when NEXT_PUBLIC_PWA_ENABLED is false', async () => {
      process.env.NEXT_PUBLIC_PWA_ENABLED = 'false'
      const result = await registerServiceWorker()
      expect(result.registered).toBe(false)
      expect(result.reason).toContain('disabled by environment')
    })

    it('safely handles unregisterServiceWorker in non-browser environments', async () => {
      const res = await unregisterServiceWorker()
      expect(typeof res).toBe('boolean')
    })
  })
})
