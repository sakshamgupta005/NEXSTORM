/**
 * Database Abstraction & Repository Types
 * 
 * Inspired by Drizzle ORM, Prisma, and Supabase PostgREST patterns.
 */

export interface DatabaseConfig {
  url?: string
  host?: string
  port?: number
  database?: string
  user?: string
  password?: string
  ssl?: boolean
  maxConnections?: number
  idleTimeoutMs?: number
  connectionTimeoutMs?: number
}

export interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  provider: string
  latencyMs: number
  activeConnections?: number
  message?: string
  error?: string
}

export interface Entity {
  id: string
  createdAt?: string | Date
  updatedAt?: string | Date
  [key: string]: unknown
}

export interface QueryFilterOptions<T extends Entity> {
  limit?: number
  offset?: number
  sortBy?: keyof T
  sortOrder?: 'asc' | 'desc'
}

export type EntityFilter<T extends Entity> =
  | Partial<T>
  | ((entity: T) => boolean)

export interface IRepository<T extends Entity> {
  findById(id: string): Promise<T | null>
  find(filter?: EntityFilter<T>, options?: QueryFilterOptions<T>): Promise<T[]>
  findOne(filter: EntityFilter<T>): Promise<T | null>
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & Partial<Entity>): Promise<T>
  update(id: string, data: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T | null>
  delete(id: string): Promise<boolean>
  count(filter?: EntityFilter<T>): Promise<number>
  exists(id: string): Promise<boolean>
}

export interface ITransactionContext {
  getRepository<T extends Entity>(collectionName: string): IRepository<T>
  rollback(): void
  isRolledBack(): boolean
}

export interface IDatabaseAdapter {
  name: string
  getRepository<T extends Entity>(collectionName: string): IRepository<T>
  transaction<R>(fn: (tx: ITransactionContext) => Promise<R>): Promise<R>
  checkHealth(): Promise<DatabaseHealth>
}

export interface Migration {
  id: string
  name: string
  up: string
  down?: string
  appliedAt?: string
}
