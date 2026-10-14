/**
 * In-Memory Database Adapter & Repository Engine
 * 
 * Provides:
 * - Type-safe generic repositories for any entity
 * - Full CRUD with pagination, sorting, and predicate filtering
 * - Atomic transaction rollback simulation with snapshot restoration
 * - 100% offline testing without external database daemons
 */

import { randomUUID } from 'node:crypto'
import type {
  Entity,
  IRepository,
  IDatabaseAdapter,
  ITransactionContext,
  DatabaseHealth,
  EntityFilter,
  QueryFilterOptions,
} from './types'

export class InMemoryRepository<T extends Entity> implements IRepository<T> {
  private items = new Map<string, T>()

  constructor(initialData: T[] = []) {
    for (const item of initialData) {
      this.items.set(item.id, { ...item })
    }
  }

  // Snapshot for transaction support
  public snapshot(): Map<string, T> {
    const clone = new Map<string, T>()
    for (const [k, v] of this.items.entries()) {
      clone.set(k, JSON.parse(JSON.stringify(v)))
    }
    return clone
  }

  public restore(snapshot: Map<string, T>): void {
    this.items = snapshot
  }

  async findById(id: string): Promise<T | null> {
    const item = this.items.get(id)
    return item ? JSON.parse(JSON.stringify(item)) : null
  }

  async exists(id: string): Promise<boolean> {
    return this.items.has(id)
  }

  async find(filter?: EntityFilter<T>, options?: QueryFilterOptions<T>): Promise<T[]> {
    let result = Array.from(this.items.values()).map((v) => JSON.parse(JSON.stringify(v)) as T)

    // 1. Filter
    if (filter) {
      if (typeof filter === 'function') {
        result = result.filter(filter)
      } else {
        const entries = Object.entries(filter)
        result = result.filter((item) =>
          entries.every(([k, v]) => (item as Record<string, unknown>)[k] === v)
        )
      }
    }

    // 2. Sort
    if (options?.sortBy) {
      const sortKey = options.sortBy
      const order = options.sortOrder === 'desc' ? -1 : 1
      result.sort((a, b) => {
        const valA = a[sortKey]
        const valB = b[sortKey]
        if (valA === valB) return 0
        if (valA === undefined || valA === null) return 1
        if (valB === undefined || valB === null) return -1
        return (String(valA) < String(valB) ? -1 : 1) * order
      })
    }

    // 3. Offset and Limit
    if (options?.offset) {
      result = result.slice(options.offset)
    }
    if (options?.limit !== undefined) {
      result = result.slice(0, options.limit)
    }

    return result
  }

  async findOne(filter: EntityFilter<T>): Promise<T | null> {
    const results = await this.find(filter, { limit: 1 })
    return results[0] || null
  }

  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & Partial<Entity>): Promise<T> {
    const now = new Date().toISOString()
    const id = data.id || `ent_${randomUUID().replace(/-/g, '').slice(0, 16)}`

    const newEntity = {
      ...data,
      id,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
    } as unknown as T

    this.items.set(id, JSON.parse(JSON.stringify(newEntity)))
    return JSON.parse(JSON.stringify(newEntity))
  }

  async update(id: string, data: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T | null> {
    const existing = this.items.get(id)
    if (!existing) return null

    const updated = {
      ...existing,
      ...data,
      id, // Preserve immutable ID
      createdAt: existing.createdAt, // Preserve immutable createdAt
      updatedAt: new Date().toISOString(),
    } as T

    this.items.set(id, JSON.parse(JSON.stringify(updated)))
    return JSON.parse(JSON.stringify(updated))
  }

  async delete(id: string): Promise<boolean> {
    return this.items.delete(id)
  }

  async count(filter?: EntityFilter<T>): Promise<number> {
    if (!filter) return this.items.size
    const list = await this.find(filter)
    return list.length
  }

  clear(): void {
    this.items.clear()
  }

  get size(): number {
    return this.items.size
  }
}

export class InMemoryDatabaseAdapter implements IDatabaseAdapter {
  public name = 'in-memory'
  private collections = new Map<string, InMemoryRepository<Entity>>()

  getRepository<T extends Entity>(collectionName: string): IRepository<T> {
    let repo = this.collections.get(collectionName)
    if (!repo) {
      repo = new InMemoryRepository<Entity>()
      this.collections.set(collectionName, repo)
    }
    return repo as unknown as IRepository<T>
  }

  async transaction<R>(fn: (tx: ITransactionContext) => Promise<R>): Promise<R> {
    // 1. Snapshot all collections before executing transaction
    const snapshots = new Map<string, Map<string, Entity>>()
    for (const [name, repo] of this.collections.entries()) {
      snapshots.set(name, repo.snapshot())
    }

    let rolledBack = false

    const txContext: ITransactionContext = {
      getRepository: <T extends Entity>(name: string) => this.getRepository<T>(name),
      rollback: () => {
        rolledBack = true
      },
      isRolledBack: () => rolledBack,
    }

    try {
      const result = await fn(txContext)

      if (rolledBack) {
        // Explicit rollback requested: restore snapshot
        for (const [name, snapshot] of snapshots.entries()) {
          this.collections.get(name)?.restore(snapshot)
        }
        throw new Error('Transaction was explicitly rolled back')
      }

      return result
    } catch (err) {
      // Error occurred: restore all snapshots
      for (const [name, snapshot] of snapshots.entries()) {
        this.collections.get(name)?.restore(snapshot)
      }
      throw err
    }
  }

  async checkHealth(): Promise<DatabaseHealth> {
    return {
      status: 'healthy',
      provider: 'in-memory',
      latencyMs: 0,
      activeConnections: 1,
      message: `In-memory database online with ${this.collections.size} active collection(s)`,
    }
  }

  clear(): void {
    this.collections.clear()
  }
}

export const sharedDatabaseAdapter = new InMemoryDatabaseAdapter()
