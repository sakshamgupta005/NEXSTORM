/**
 * src/lib/alerts/repository.ts
 * Dual-mode repository abstraction for Subscribers and Alert Deliveries.
 * Connects to Supabase / PostgreSQL when configured; falls back to atomic file storage for dev/test.
 */

import fs from 'node:fs'
import path from 'node:path'
import { isSupabaseConfigured, getSupabaseEnv } from '../supabase/config'
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'
import { logger } from '../logging/logger'
import type { DeliveryRecord, SubscriberPreference } from './types'

import { listSupportedCities } from '../city/registry'

export interface IAlertRepository {
  readonly storageType: 'supabase_postgres' | 'local_file_dev'
  isDurable(): boolean

  // Subscriber methods
  getSubscriberById(id: string): Promise<SubscriberPreference | null>
  getSubscribersByCity(cityId: string, options?: { optedInOnly?: boolean }): Promise<SubscriberPreference[]>
  saveSubscriber(subscriber: SubscriberPreference): Promise<void>
  unsubscribe(id: string): Promise<boolean>

  // Delivery queue methods
  addDelivery(delivery: DeliveryRecord): Promise<void>
  getDeliveryById(id: string): Promise<DeliveryRecord | null>
  getDeliveriesBySubscriber(subscriberId: string, limit?: number): Promise<DeliveryRecord[]>
  updateDeliveryStatus(
    deliveryId: string,
    status: DeliveryRecord['status'],
    options?: { failureReason?: string; deliveredAt?: string }
  ): Promise<boolean>
  isIdempotencyKeyDelivered(key: string): Promise<boolean>
  getRecentDeliveriesForSubscriber(subscriberId: string, withinSeconds: number): Promise<DeliveryRecord[]>
  reset(cityId?: string): Promise<void>
}

/**
 * File-backed repository with atomic JSON writes and promise write-lock serialization.
 */
export class FileAlertRepository implements IAlertRepository {
  public readonly storageType = 'local_file_dev' as const
  private writeLock: Promise<void> = Promise.resolve()

  public isDurable(): boolean {
    return false
  }

  private getAllCityIds(): string[] {
    try {
      const cities = listSupportedCities()
      const citiesDir = path.join(process.cwd(), 'public', 'data', 'cities')
      if (fs.existsSync(citiesDir)) {
        const dirs = fs
          .readdirSync(citiesDir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name.toLowerCase())
        return Array.from(new Set([...cities, ...dirs]))
      }
      return cities.length > 0 ? cities : ['amritsar']
    } catch {
      return ['amritsar']
    }
  }

  private getStorageDir(cityId: string = 'amritsar'): string {
    const dir = path.join(process.cwd(), 'public', 'data', 'cities', cityId.toLowerCase(), 'alerts')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  private getSubscribersPath(cityId: string): string {
    return path.join(this.getStorageDir(cityId), 'subscribers.json')
  }

  private getDeliveriesPath(cityId: string): string {
    return path.join(this.getStorageDir(cityId), 'deliveries.json')
  }

  private async enqueue<T>(op: () => Promise<T> | T): Promise<T> {
    const next = this.writeLock.then(async () => op())
    this.writeLock = next.then(() => {}, () => {})
    return next
  }

  private readJson<T>(filePath: string): T[] {
    if (!fs.existsSync(filePath)) return []
    try {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  private writeAtomic<T>(filePath: string, data: T[]): void {
    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`
    try {
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8')
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
      fs.renameSync(tempPath, filePath)
    } catch (err) {
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath) } catch { /* ignore */ }
      }
      throw err
    }
  }

  public async getSubscriberById(id: string): Promise<SubscriberPreference | null> {
    // Search across all supported cities
    const cities = this.getAllCityIds()
    for (const city of cities) {
      const subs = this.readJson<SubscriberPreference>(this.getSubscribersPath(city))
      const found = subs.find((s) => s.id === id)
      if (found) return found
    }
    return null
  }

  public async getSubscribersByCity(
    cityId: string = 'amritsar',
    options?: { optedInOnly?: boolean }
  ): Promise<SubscriberPreference[]> {
    const subs = this.readJson<SubscriberPreference>(this.getSubscribersPath(cityId))
    if (options?.optedInOnly) {
      return subs.filter((s) => s.isOptedIn)
    }
    return subs
  }

  public async saveSubscriber(subscriber: SubscriberPreference): Promise<void> {
    return this.enqueue(async () => {
      const filePath = this.getSubscribersPath(subscriber.cityId)
      const subs = this.readJson<SubscriberPreference>(filePath)
      const idx = subs.findIndex((s) => s.id === subscriber.id)
      if (idx !== -1) {
        subs[idx] = { ...subscriber, updatedAt: new Date().toISOString() }
      } else {
        subs.push({ ...subscriber, updatedAt: new Date().toISOString() })
      }
      this.writeAtomic(filePath, subs)
    })
  }

  public async unsubscribe(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const cities = this.getAllCityIds()
      for (const city of cities) {
        const filePath = this.getSubscribersPath(city)
        const subs = this.readJson<SubscriberPreference>(filePath)
        const sub = subs.find((s) => s.id === id)
        if (sub) {
          sub.isOptedIn = false
          sub.unsubscribedAt = new Date().toISOString()
          sub.updatedAt = new Date().toISOString()
          this.writeAtomic(filePath, subs)
          return true
        }
      }
      return false
    })
  }

  public async addDelivery(delivery: DeliveryRecord): Promise<void> {
    return this.enqueue(async () => {
      const cityId = (delivery.payload?.cityId || 'amritsar').toLowerCase()
      const filePath = this.getDeliveriesPath(cityId)
      const deliveries = this.readJson<DeliveryRecord>(filePath)
      const existing = deliveries.find(
        (d) => d.idempotencyKey === delivery.idempotencyKey || d.deliveryId === delivery.deliveryId
      )
      if (existing) {
        return
      }
      deliveries.push(delivery)
      this.writeAtomic(filePath, deliveries)
    })
  }

  public async getDeliveryById(id: string): Promise<DeliveryRecord | null> {
    const cities = this.getAllCityIds()
    for (const city of cities) {
      const deliveries = this.readJson<DeliveryRecord>(this.getDeliveriesPath(city))
      const found = deliveries.find((d) => d.deliveryId === id)
      if (found) return found
    }
    return null
  }

  public async getDeliveriesBySubscriber(subscriberId: string, limit: number = 50): Promise<DeliveryRecord[]> {
    const sub = await this.getSubscriberById(subscriberId)
    const targetCities = sub ? [sub.cityId.toLowerCase()] : this.getAllCityIds()
    const allDeliveries: DeliveryRecord[] = []
    for (const city of targetCities) {
      const deliveries = this.readJson<DeliveryRecord>(this.getDeliveriesPath(city))
      allDeliveries.push(...deliveries.filter((d) => d.subscriberId === subscriberId))
    }
    return allDeliveries
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-limit)
      .reverse()
  }

  public async updateDeliveryStatus(
    deliveryId: string,
    status: DeliveryRecord['status'],
    options?: { failureReason?: string; deliveredAt?: string }
  ): Promise<boolean> {
    return this.enqueue(async () => {
      const cities = this.getAllCityIds()
      for (const city of cities) {
        const filePath = this.getDeliveriesPath(city)
        const deliveries = this.readJson<DeliveryRecord>(filePath)
        const d = deliveries.find((x) => x.deliveryId === deliveryId)
        if (d) {
          d.status = status
          d.updatedAt = new Date().toISOString()
          if (options?.failureReason) d.failureReason = options.failureReason
          if (options?.deliveredAt) d.deliveredAt = options.deliveredAt
          this.writeAtomic(filePath, deliveries)
          return true
        }
      }
      return false
    })
  }

  public async isIdempotencyKeyDelivered(key: string): Promise<boolean> {
    const cities = this.getAllCityIds()
    for (const city of cities) {
      const deliveries = this.readJson<DeliveryRecord>(this.getDeliveriesPath(city))
      const match = deliveries.find((d) => d.idempotencyKey === key)
      if (match && (match.status === 'delivered' || match.status === 'pending')) {
        return true
      }
    }
    return false
  }

  public async getRecentDeliveriesForSubscriber(subscriberId: string, withinSeconds: number): Promise<DeliveryRecord[]> {
    const sub = await this.getSubscriberById(subscriberId)
    const targetCities = sub ? [sub.cityId.toLowerCase()] : this.getAllCityIds()
    const thresholdTime = Date.now() - withinSeconds * 1000
    const matched: DeliveryRecord[] = []
    for (const city of targetCities) {
      const deliveries = this.readJson<DeliveryRecord>(this.getDeliveriesPath(city))
      for (const d of deliveries) {
        if (d.subscriberId === subscriberId && new Date(d.createdAt).getTime() >= thresholdTime) {
          matched.push(d)
        }
      }
    }
    return matched
  }

  public async reset(cityId?: string): Promise<void> {
    return this.enqueue(async () => {
      const targetCities = cityId ? [cityId.toLowerCase()] : this.getAllCityIds()
      for (const city of targetCities) {
        const subPath = this.getSubscribersPath(city)
        const delPath = this.getDeliveriesPath(city)
        if (fs.existsSync(subPath)) fs.unlinkSync(subPath)
        if (fs.existsSync(delPath)) fs.unlinkSync(delPath)
      }
    })
  }
}

/**
 * Supabase PostgreSQL Repository for Durable Production Deployments.
 */
export class SupabaseAlertRepository implements IAlertRepository {
  public readonly storageType = 'supabase_postgres' as const
  private client: SupabaseClient

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

  public async getSubscriberById(id: string): Promise<SubscriberPreference | null> {
    const { data, error } = await this.client.from('alert_subscribers').select('*').eq('id', id).single()
    if (error || !data) return null
    return this.mapRowToSubscriber(data)
  }

  public async getSubscribersByCity(
    cityId: string = 'amritsar',
    options?: { optedInOnly?: boolean }
  ): Promise<SubscriberPreference[]> {
    let query = this.client.from('alert_subscribers').select('*').eq('city_id', cityId)
    if (options?.optedInOnly) {
      query = query.eq('is_opted_in', true)
    }
    const { data, error } = await query
    if (error || !data) return []
    return data.map(this.mapRowToSubscriber)
  }

  public async saveSubscriber(sub: SubscriberPreference): Promise<void> {
    const row = {
      id: sub.id,
      city_id: sub.cityId,
      channel: sub.channel,
      destination: sub.destination,
      sensitivity: sub.sensitivity,
      geofence_type: sub.geofence.type,
      target_cells: sub.geofence.cellIds || [],
      target_corridor: sub.geofence.roadCorridor || null,
      target_bbox: sub.geofence.bbox || null,
      quiet_hours_enabled: sub.quietHours?.enabled ?? false,
      quiet_start_hour: sub.quietHours?.startLocalHour ?? null,
      quiet_end_hour: sub.quietHours?.endLocalHour ?? null,
      timezone: sub.quietHours?.timezone || 'Asia/Kolkata',
      is_opted_in: sub.isOptedIn,
      is_verified: sub.isVerified,
      is_test_subscriber: sub.isTestSubscriber,
      consent_timestamp: sub.consentTimestamp,
      unsubscribed_at: sub.unsubscribedAt || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await this.client.from('alert_subscribers').upsert(row)
    if (error) {
      logger.error('Failed to save subscriber in Supabase:', { error: error.message })
      throw new Error(`Durable subscriber persistence failed: ${error.message}`)
    }
  }

  public async unsubscribe(id: string): Promise<boolean> {
    const { error } = await this.client
      .from('alert_subscribers')
      .update({ is_opted_in: false, unsubscribed_at: new Date().toISOString() })
      .eq('id', id)
    return !error
  }

  public async addDelivery(delivery: DeliveryRecord): Promise<void> {
    const row = {
      id: delivery.deliveryId,
      decision_id: delivery.decisionId,
      subscriber_id: delivery.subscriberId,
      idempotency_key: delivery.idempotencyKey,
      channel: delivery.channel,
      status: delivery.status,
      attempt_count: delivery.attemptCount,
      max_attempts: delivery.maxAttempts,
      last_attempt_at: delivery.lastAttemptAt || null,
      delivered_at: delivery.deliveredAt || null,
      failure_reason: delivery.failureReason || null,
      payload: delivery.payload,
      created_at: delivery.createdAt,
      updated_at: delivery.updatedAt,
    }
    const { error } = await this.client.from('alert_deliveries').upsert(row)
    if (error) {
      logger.error('Failed to upsert delivery into Supabase:', { error: error.message })
      throw new Error(`Durable delivery persistence failed: ${error.message}`)
    }
  }

  public async getDeliveryById(id: string): Promise<DeliveryRecord | null> {
    const { data, error } = await this.client.from('alert_deliveries').select('*').eq('id', id).single()
    if (error || !data) return null
    return this.mapRowToDelivery(data)
  }

  public async getDeliveriesBySubscriber(subscriberId: string, limit: number = 50): Promise<DeliveryRecord[]> {
    const { data, error } = await this.client
      .from('alert_deliveries')
      .select('*')
      .eq('subscriber_id', subscriberId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return data.map(this.mapRowToDelivery)
  }

  public async updateDeliveryStatus(
    deliveryId: string,
    status: DeliveryRecord['status'],
    options?: { failureReason?: string; deliveredAt?: string }
  ): Promise<boolean> {
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    }
    if (options?.failureReason) updates.failure_reason = options.failureReason
    if (options?.deliveredAt) updates.delivered_at = options.deliveredAt

    const { error } = await this.client.from('alert_deliveries').update(updates).eq('id', deliveryId)
    return !error
  }

  public async isIdempotencyKeyDelivered(key: string): Promise<boolean> {
    const { data } = await this.client
      .from('alert_deliveries')
      .select('status')
      .eq('idempotency_key', key)
      .maybeSingle()
    return Boolean(data && (data.status === 'delivered' || data.status === 'pending'))
  }

  public async getRecentDeliveriesForSubscriber(subscriberId: string, withinSeconds: number): Promise<DeliveryRecord[]> {
    const since = new Date(Date.now() - withinSeconds * 1000).toISOString()
    const { data } = await this.client
      .from('alert_deliveries')
      .select('*')
      .eq('subscriber_id', subscriberId)
      .gte('created_at', since)
    if (!data) return []
    return data.map(this.mapRowToDelivery)
  }

  public async reset(cityId: string = 'amritsar'): Promise<void> {
    await this.client.from('alert_deliveries').delete().neq('id', '')
    await this.client.from('alert_subscribers').delete().eq('city_id', cityId)
  }

  private mapRowToSubscriber(row: Record<string, unknown>): SubscriberPreference {
    return {
      id: row.id as string,
      cityId: row.city_id as string,
      channel: row.channel as SubscriberPreference['channel'],
      destination: row.destination as string,
      sensitivity: row.sensitivity as SubscriberPreference['sensitivity'],
      geofence: {
        type: row.geofence_type as SubscriberPreference['geofence']['type'],
        cellIds: (row.target_cells as string[]) || undefined,
        roadCorridor: (row.target_corridor as string) || undefined,
        bbox: (row.target_bbox as [number, number, number, number]) || undefined,
      },
      quietHours: row.quiet_hours_enabled
        ? {
            enabled: true,
            startLocalHour: row.quiet_start_hour as number,
            endLocalHour: row.quiet_end_hour as number,
            timezone: (row.timezone as string) || 'Asia/Kolkata',
          }
        : undefined,
      isOptedIn: row.is_opted_in as boolean,
      isVerified: row.is_verified as boolean,
      isTestSubscriber: row.is_test_subscriber as boolean,
      consentTimestamp: row.consent_timestamp as string,
      unsubscribedAt: (row.unsubscribed_at as string) || undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }
  }

  private mapRowToDelivery(row: Record<string, unknown>): DeliveryRecord {
    return {
      deliveryId: row.id as string,
      decisionId: row.decision_id as string,
      subscriberId: row.subscriber_id as string,
      idempotencyKey: row.idempotency_key as string,
      channel: row.channel as DeliveryRecord['channel'],
      status: row.status as DeliveryRecord['status'],
      attemptCount: row.attempt_count as number,
      maxAttempts: row.max_attempts as number,
      lastAttemptAt: (row.last_attempt_at as string) || undefined,
      deliveredAt: (row.delivered_at as string) || undefined,
      failureReason: (row.failure_reason as string) || undefined,
      payload: row.payload as DeliveryRecord['payload'],
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }
  }
}

// Global repository singleton
let instance: IAlertRepository | null = null

export function getAlertRepository(): IAlertRepository {
  if (instance) return instance

  if (isSupabaseConfigured() && process.env.NODE_ENV !== 'test') {
    try {
      instance = new SupabaseAlertRepository()
      return instance
    } catch (err) {
      logger.warn('Failed to initialize SupabaseAlertRepository, falling back to FileAlertRepository', {
        error: String(err),
      })
    }
  }

  instance = new FileAlertRepository()
  return instance
}
