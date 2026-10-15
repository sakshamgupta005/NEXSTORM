/**
 * src/lib/observations/repository.ts
 * Repository abstraction for NEXSTORM observations.
 * Supports durable Supabase / PostgreSQL storage when configured,
 * with atomic, mutex-serialized file-backed storage for offline development.
 */

import fs from 'node:fs'
import path from 'node:path'
import { isSupabaseConfigured, getSupabaseEnv } from '../supabase/config'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { logger } from '../logging/logger'
import type { WaterloggingObservation } from './types'

export interface IObservationRepository {
  readonly storageType: 'supabase_postgres' | 'local_file_dev'
  isDurable(): boolean
  getAll(cityId: string): Promise<WaterloggingObservation[]>
  saveAll(observations: WaterloggingObservation[], cityId: string): Promise<void>
  add(observation: WaterloggingObservation, cityId: string): Promise<void>
  update(observation: WaterloggingObservation, cityId: string): Promise<boolean>
  getById(id: string, cityId: string): Promise<WaterloggingObservation | null>
  reset(cityId: string): Promise<void>
}

/**
 * File-backed observation repository for offline development and testing.
 * Uses a FIFO serialization queue to prevent lost updates under concurrent requests.
 */
export class FileObservationRepository implements IObservationRepository {
  public readonly storageType = 'local_file_dev' as const
  private writeLock: Promise<void> = Promise.resolve()

  constructor() {
    if (process.env.NODE_ENV === 'production') {
      logger.warn(
        '[OBSERVATION_STORAGE_WARN] Running with local file-backed storage in production. ' +
        'Community observations will NOT survive container restarts or multi-instance deployments. ' +
        'Configure Supabase (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) for durable persistence.'
      )
    }
  }

  public isDurable(): boolean {
    return false
  }

  private getStoragePath(cityId: string = 'amritsar'): string {
    const dir = path.join(process.cwd(), 'public', 'data', 'cities', cityId, 'observations')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return path.join(dir, 'observations.json')
  }

  public async getAll(cityId: string = 'amritsar'): Promise<WaterloggingObservation[]> {
    const filePath = this.getStoragePath(cityId)
    if (!fs.existsSync(filePath)) {
      return []
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch (err) {
      logger.error('Failed to read observations file:', { error: String(err) })
      return []
    }
  }

  private writeAtomic(observations: WaterloggingObservation[], cityId: string): void {
    const filePath = this.getStoragePath(cityId)
    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`
    try {
      fs.writeFileSync(tempPath, JSON.stringify(observations, null, 2), 'utf-8')
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
      fs.renameSync(tempPath, filePath)
    } catch (err) {
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath) } catch { /* ignore */ }
      }
      logger.error('Failed to atomically write observations file:', { error: String(err) })
      throw err
    }
  }

  public async saveAll(observations: WaterloggingObservation[], cityId: string = 'amritsar'): Promise<void> {
    return this.enqueue(async () => {
      this.writeAtomic(observations, cityId)
    })
  }

  public async add(observation: WaterloggingObservation, cityId: string = 'amritsar'): Promise<void> {
    return this.enqueue(async () => {
      const all = await this.getAll(cityId)
      all.push(observation)
      this.writeAtomic(all, cityId)
    })
  }

  public async update(observation: WaterloggingObservation, cityId: string = 'amritsar'): Promise<boolean> {
    return this.enqueue(async () => {
      const all = await this.getAll(cityId)
      const idx = all.findIndex((o) => o.id === observation.id)
      if (idx === -1) return false
      all[idx] = observation
      this.writeAtomic(all, cityId)
      return true
    })
  }

  public async getById(id: string, cityId: string = 'amritsar'): Promise<WaterloggingObservation | null> {
    const all = await this.getAll(cityId)
    return all.find((o) => o.id === id) || null
  }

  public async reset(cityId: string = 'amritsar'): Promise<void> {
    return this.enqueue(async () => {
      const filePath = this.getStoragePath(cityId)
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath)
        } catch {
          // Ignore unlink errors
        }
      }
    })
  }

  /**
   * Enqueues an async task behind the current write lock to prevent race conditions.
   */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.writeLock.then(task, task)
    this.writeLock = next.then(() => {}, () => {})
    return next
  }
}

/**
 * Supabase / PostgreSQL observation repository for production durability.
 */
export class SupabaseObservationRepository implements IObservationRepository {
  public readonly storageType = 'supabase_postgres' as const
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any

  constructor() {
    const { url, anonKey } = getSupabaseEnv()
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey
    this.client = createSupabaseClient(url, serviceKey, {
      auth: { persistSession: false },
    })
  }

  public isDurable(): boolean {
    return true
  }

  public async getAll(cityId: string = 'amritsar'): Promise<WaterloggingObservation[]> {
    try {
      const { data, error } = await this.client
        .from('observations')
        .select('*')
        .eq('city_id', cityId)
        .order('observed_at', { ascending: false })

      if (error) {
        logger.error('Supabase query observations error:', { error: error.message })
        return []
      }

      return (data || []).map(this.mapRowToObservation)
    } catch (err) {
      logger.error('Supabase connection failure reading observations:', { error: String(err) })
      return []
    }
  }

  public async saveAll(observations: WaterloggingObservation[], cityId: string = 'amritsar'): Promise<void> {
    for (const obs of observations) {
      await this.add(obs, cityId)
    }
  }

  public async add(observation: WaterloggingObservation, cityId: string = 'amritsar'): Promise<void> {
    const row = this.mapObservationToRow(observation, cityId)
    const { error } = await this.client.from('observations').upsert(row)
    if (error) {
      logger.error('Failed to upsert observation into Supabase:', { error: error.message })
      throw new Error(`Durable persistence failed: ${error.message}`)
    }
  }

  public async update(observation: WaterloggingObservation, cityId: string = 'amritsar'): Promise<boolean> {
    const row = this.mapObservationToRow(observation, cityId)
    const { error } = await this.client
      .from('observations')
      .update(row)
      .eq('id', observation.id)

    if (error) {
      logger.error('Failed to update observation in Supabase:', { error: error.message })
      return false
    }
    return true
  }

  public async getById(id: string, cityId: string = 'amritsar'): Promise<WaterloggingObservation | null> {
    const { data, error } = await this.client
      .from('observations')
      .select('*')
      .eq('id', id)
      .eq('city_id', cityId)
      .single()

    if (error || !data) return null
    return this.mapRowToObservation(data)
  }

  public async reset(cityId: string = 'amritsar'): Promise<void> {
    await this.client.from('observations').delete().eq('city_id', cityId)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapRowToObservation(row: any): WaterloggingObservation {
    return {
      id: row.id,
      schemaVersion: row.schema_version || '1.0.0',
      cityId: row.city_id,
      createdAt: row.created_at,
      submittedAt: row.submitted_at,
      observedAt: row.observed_at,
      coordinates: { lat: row.lat, lng: row.lng },
      spatialMatch: row.spatial_match || {},
      category: row.category,
      severity: row.severity,
      description: row.description || undefined,
      photoUrl: row.photo_url || undefined,
      reporterHash: row.reporter_hash,
      sourceType: row.source_type,
      lifecycleStatus: row.lifecycle_status,
      verification: row.verification,
      corroboration: row.corroboration,
      freshness: row.freshness,
      scientificCaveat: row.scientific_caveat,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapObservationToRow(obs: WaterloggingObservation, cityId: string): Record<string, any> {
    return {
      id: obs.id,
      schema_version: obs.schemaVersion,
      city_id: cityId,
      created_at: obs.createdAt,
      submitted_at: obs.submittedAt,
      observed_at: obs.observedAt,
      lat: obs.coordinates.lat,
      lng: obs.coordinates.lng,
      cell_id: obs.spatialMatch.cellId,
      road_segment_id: obs.spatialMatch.roadSegmentId,
      road_name: obs.spatialMatch.roadName,
      spatial_match: obs.spatialMatch,
      category: obs.category,
      severity: obs.severity,
      description: obs.description || null,
      photo_url: obs.photoUrl || null,
      reporter_hash: obs.reporterHash,
      source_type: obs.sourceType,
      lifecycle_status: obs.lifecycleStatus,
      verification: obs.verification,
      corroboration: obs.corroboration,
      freshness: obs.freshness,
      scientific_caveat: obs.scientificCaveat,
    }
  }
}

/**
 * Creates the appropriate observation repository based on active environment credentials.
 */
export function getObservationRepository(): IObservationRepository {
  if (isSupabaseConfigured()) {
    try {
      return new SupabaseObservationRepository()
    } catch (err) {
      logger.warn('Failed to initialize Supabase repository; falling back to file repository:', {
        error: String(err),
      })
    }
  }
  return new FileObservationRepository()
}
