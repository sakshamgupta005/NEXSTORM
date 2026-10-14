/**
 * Lightweight, Promise-based IndexedDB client storage wrapper.
 * Provides structured offline storage with in-memory fallback for SSR/testing environments.
 */

const DEFAULT_DB_NAME = 'hackathon_offline_db'
const DEFAULT_VERSION = 1
const DEFAULT_STORE_NAME = 'keyval'

class InMemoryDb {
  private stores = new Map<string, Map<string, unknown>>()

  public get<T>(storeName: string, key: string): T | undefined {
    return this.stores.get(storeName)?.get(key) as T | undefined
  }

  public set<T>(storeName: string, key: string, value: T): void {
    if (!this.stores.has(storeName)) {
      this.stores.set(storeName, new Map())
    }
    this.stores.get(storeName)!.set(key, value)
  }

  public delete(storeName: string, key: string): void {
    this.stores.get(storeName)?.delete(key)
  }

  public getAll<T>(storeName: string): T[] {
    const store = this.stores.get(storeName)
    if (!store) return []
    return Array.from(store.values()) as T[]
  }

  public clear(storeName: string): void {
    this.stores.get(storeName)?.clear()
  }
}

export class OfflineStorage {
  private dbName: string
  private version: number
  private inMemoryDb: InMemoryDb | null = null

  constructor(dbName = DEFAULT_DB_NAME, version = DEFAULT_VERSION) {
    this.dbName = dbName
    this.version = version

    if (typeof window === 'undefined' || !window.indexedDB) {
      this.inMemoryDb = new InMemoryDb()
    }
  }

  private async getDb(): Promise<IDBDatabase> {
    if (this.inMemoryDb) {
      throw new Error('IndexedDB not supported in current environment')
    }

    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(this.dbName, this.version)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        // Create default keyval store and offline_actions store
        if (!db.objectStoreNames.contains(DEFAULT_STORE_NAME)) {
          db.createObjectStore(DEFAULT_STORE_NAME)
        }
        if (!db.objectStoreNames.contains('offline_actions')) {
          db.createObjectStore('offline_actions', { keyPath: 'id' })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  public async get<T>(key: string, storeName = DEFAULT_STORE_NAME): Promise<T | undefined> {
    if (this.inMemoryDb) {
      return this.inMemoryDb.get<T>(storeName, key)
    }

    try {
      const db = await this.getDb()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly')
        const store = tx.objectStore(storeName)
        const req = store.get(key)
        req.onsuccess = () => resolve(req.result as T | undefined)
        req.onerror = () => reject(req.error)
      })
    } catch {
      return undefined
    }
  }

  public async set<T>(key: string, value: T, storeName = DEFAULT_STORE_NAME): Promise<void> {
    if (this.inMemoryDb) {
      this.inMemoryDb.set(storeName, key, value)
      return
    }

    const db = await this.getDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const req = store.put(value, key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }

  public async delete(key: string, storeName = DEFAULT_STORE_NAME): Promise<void> {
    if (this.inMemoryDb) {
      this.inMemoryDb.delete(storeName, key)
      return
    }

    const db = await this.getDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const req = store.delete(key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }

  public async getAll<T>(storeName = DEFAULT_STORE_NAME): Promise<T[]> {
    if (this.inMemoryDb) {
      return this.inMemoryDb.getAll<T>(storeName)
    }

    const db = await this.getDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result as T[])
      req.onerror = () => reject(req.error)
    })
  }

  public async clear(storeName = DEFAULT_STORE_NAME): Promise<void> {
    if (this.inMemoryDb) {
      this.inMemoryDb.clear(storeName)
      return
    }

    const db = await this.getDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const req = store.clear()
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }
}

export const offlineStorage = new OfflineStorage()
