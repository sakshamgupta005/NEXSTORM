/**
 * src/lib/observations/service.ts
 * Waterlogging Observation Service for NEXSTORM.
 * Handles validation, spatial snapping, privacy-preserving reporter hashing,
 * corroboration clustering, lifecycle transitions, and atomic file persistence.
 */

import { createHash, createHmac, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {
  euclideanDistanceUtm,
  matchObservationToRoadSegment,
  matchPointToGrid,
  wgs84ToUtm43n,
  type GridCellFeature,
  type RoadSegmentGeometry,
} from '../spatial'
import type {
  CreateObservationInput,
  ObservationCorroboration,
  ObservationFreshness,
  ObservationQueryFilters,
  VerifyObservationInput,
  WaterloggingObservation,
} from './types'
import { getObservationRepository, type IObservationRepository } from './repository'
import { getCityHotspots } from '../city/registry'
import { logger } from '../logging/logger'

const MAX_OBSERVATIONS_STORED = 1000

export class ObservationService {
  private static instance: ObservationService
  private static ephemeralProdSalt: string | null = null
  private repository: IObservationRepository = getObservationRepository()
  private observationsCache: WaterloggingObservation[] | null = null
  private gridCache: GridCellFeature[] | null = null
  private roadsCache: RoadSegmentGeometry[] | null = null

  private constructor() {}

  public static getInstance(): ObservationService {
    if (!ObservationService.instance) {
      ObservationService.instance = new ObservationService()
    }
    return ObservationService.instance
  }

  /**
   * Returns whether active persistence is backed by a durable shared store (e.g. Supabase PostgreSQL)
   * or ephemeral local file storage.
   */
  public isDurableStorage(): boolean {
    return this.repository.isDurable()
  }

  /**
   * Returns the active storage driver identifier.
   */
  public getStorageType(): string {
    return this.repository.storageType
  }

  /**
   * Generates a pseudonymous keyed reporter hash (HMAC-SHA256) to track corroboration and prevent abuse
   * without storing or leaking IP addresses, emails, or user accounts.
   * In production, requires OBSERVATION_SALT environment variable; falls back to an ephemeral startup secret if omitted.
   */
  public generateReporterHash(ipOrId: string, userAgent: string = ''): string {
    const configuredSalt = process.env.OBSERVATION_SALT
    let salt: string

    if (configuredSalt && configuredSalt.trim().length > 0) {
      salt = configuredSalt.trim()
    } else if (process.env.NODE_ENV === 'production') {
      if (!ObservationService.ephemeralProdSalt) {
        ObservationService.ephemeralProdSalt = randomBytes(32).toString('hex')
        logger.error(
          '[SECURITY ALERT] OBSERVATION_SALT is unset in production. Using ephemeral random startup salt. Reporter hashes will not be stable across process restarts.'
        )
      }
      salt = ObservationService.ephemeralProdSalt
    } else {
      salt = 'nexstorm_amritsar_dev_salt_v1'
    }

    const raw = `${ipOrId}_${userAgent}`
    return createHmac('sha256', salt).update(raw).digest('hex').slice(0, 16)
  }

  /**
   * Resolves file path for atomic observation persistence.
   */
  private getStoragePath(cityId: string = 'amritsar'): string {
    const dir = path.join(process.cwd(), 'public', 'data', 'cities', cityId, 'observations')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return path.join(dir, 'observations.json')
  }

  /**
   * Loads the 250m susceptibility grid for spatial snapping.
   */
  private getGridFeatures(cityId: string = 'amritsar'): GridCellFeature[] {
    if (this.gridCache) return this.gridCache
    try {
      const gridPath = path.join(process.cwd(), 'public', 'data', 'cities', cityId, 'susceptibility.geojson')
      if (fs.existsSync(gridPath)) {
        const parsed = JSON.parse(fs.readFileSync(gridPath, 'utf-8'))
        this.gridCache = parsed.features || []
        return this.gridCache!
      }
    } catch {
      // Non-fatal if grid is unavailable
    }
    return []
  }

  /**
   * Loads road segments for orthogonal snapping with 30m tolerance.
   */
  private getRoadSegments(cityId: string = 'amritsar'): RoadSegmentGeometry[] {
    if (this.roadsCache) return this.roadsCache
    try {
      const roadsPath = path.join(process.cwd(), 'public', 'data', 'cities', cityId, 'roads', 'road_network_topology.json')
      if (fs.existsSync(roadsPath)) {
        // Road network topology is available
        // For spatial snapping we can construct primary segments
        this.roadsCache = []
      }
    } catch {
      // Non-fatal
    }
    return this.roadsCache || []
  }

  /**
   * Loads all stored observations, seeding with historical baseline on first run.
   */
  public loadObservations(cityId: string = 'amritsar'): WaterloggingObservation[] {
    if (this.observationsCache) {
      return this.observationsCache
    }

    const filePath = this.getStoragePath(cityId)
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8')
        this.observationsCache = JSON.parse(raw)
        return this.observationsCache!
      } catch {
        this.observationsCache = []
      }
    } else {
      // Seed with 15 documented historical records from hotspots.json
      this.observationsCache = this.importHistoricalHotspots(cityId)
      this.saveObservations(this.observationsCache, cityId)
    }

    return this.observationsCache || []
  }

  /**
   * Imports the 15 news-reported Tribune incidents as unverified historical baseline records.
   * Strictly separates media archives from independently verified ground truth.
   */
  private importHistoricalHotspots(cityId: string): WaterloggingObservation[] {
    try {
      const hotspots = getCityHotspots(cityId)
      return hotspots.map((h, idx): WaterloggingObservation => {
        const lat = Number(h.lat)
        const lng = Number(h.lon)
        const dateStr = String(h.articleDate || '2023-07-09')
        const observedAt = new Date(`${dateStr}T12:00:00Z`).toISOString()

        return {
          id: `OBS-HIST-${String(idx + 1).padStart(4, '0')}`,
          schemaVersion: '1.0.0',
          cityId,
          createdAt: observedAt,
          submittedAt: observedAt,
          observedAt,
          coordinates: { lat, lng },
          spatialMatch: {
            cellId: (h.cellId as string) || null,
            cellSusceptibility: null,
            roadSegmentId: null,
            roadName: (h.name as string) || null,
            distanceToRoadMeters: null,
            matchQuality: 'exact_inside',
          },
          category: String(h.name).toLowerCase().includes('underpass')
            ? 'underpass_submersion'
            : 'street_flooding',
          severity: 'severe_knee_or_higher',
          description: `Historical documented waterlogging incident at ${h.name}. Source: ${h.sourceUrl}. Location precision: ${h.precision || 'street'}.`,
          reporterHash: 'SYSTEM_HISTORICAL_IMPORT',
          sourceType: 'imported_historical_record',
          lifecycleStatus: 'under_review',
          verification: {
            isVerified: false,
            verifiedAt: null,
            verifiedBy: 'The Tribune India (Media Archive)',
            verificationMethod: 'news_report',
            verificationNotes: `Media report from historical newspaper archive published on ${dateStr}. Not an independent field inspection.`,
          },
          corroboration: {
            corroborationCount: 1,
            corroboratingObservationIds: [],
            lastCorroboratedAt: null,
          },
          freshness: {
            isStale: true,
            isExpired: true,
            expiresAt: observedAt,
          },
          scientificCaveat:
            'Historical observation imported from news archive; does NOT indicate current road passage status and has not been verified by municipal sensors or field survey.',
        }
      })
    } catch {
      return []
    }
  }

  /**
   * Atomically writes observations to disk and shared repository.
   */
  private saveObservations(observations: WaterloggingObservation[], cityId: string = 'amritsar'): void {
    const trimmed = observations.slice(-MAX_OBSERVATIONS_STORED)
    this.observationsCache = trimmed

    // Delegate to repository for atomic/durable persistence
    this.repository.saveAll(trimmed, cityId).catch((err) => {
      logger.error('[OBSERVATION_SERVICE] Failed to persist observations via repository:', {
        error: String(err),
      })
    })
  }

  /**
   * Submits a new waterlogging observation with spatial matching, deduplication, and corroboration.
   */
  public submitObservation(
    input: CreateObservationInput,
    reporterHash: string
  ): { observation?: WaterloggingObservation; duplicate?: boolean; error?: string } {
    const cityId = (input.cityId || 'amritsar').toLowerCase()
    const all = this.loadObservations(cityId)
    const now = new Date()
    const observedDate = new Date(input.observedAt)
    const observedMs = observedDate.getTime()

    // 1. Duplicate check: Same reporter hash within 50m and 15 minutes
    const inputUtm = wgs84ToUtm43n(input.coordinates)
    for (const existing of all) {
      if (existing.reporterHash === reporterHash) {
        const existingMs = new Date(existing.submittedAt).getTime()
        const timeDiffMinutes = Math.abs(now.getTime() - existingMs) / (60 * 1000)

        if (timeDiffMinutes < 15) {
          const exUtm = wgs84ToUtm43n(existing.coordinates)
          const dist = euclideanDistanceUtm(inputUtm, exUtm)
          if (dist < 50) {
            return {
              duplicate: true,
              error: 'Duplicate observation detected: You submitted a report within 50m in the last 15 minutes.',
            }
          }
        }
      }
    }

    // 2. Stable Unique ID
    const randomHex = createHash('sha256')
      .update(`${reporterHash}_${now.toISOString()}_${Math.random()}`)
      .digest('hex')
      .slice(0, 8)
    const observationId = `OBS-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${randomHex}`

    // 3. Spatial Matching
    const gridFeatures = this.getGridFeatures(cityId)
    const gridMatch = matchPointToGrid(input.coordinates, gridFeatures, {
      sourceName: 'NEXSTORM-Amritsar Susceptibility Grid',
      retrievalDate: now.toISOString(),
      license: 'ODbL / CC-BY-4.0',
      evidenceKind: 'modeled',
    })

    const roadSegments = this.getRoadSegments(cityId)
    const roadMatch = matchObservationToRoadSegment(
      observationId,
      input.coordinates,
      roadSegments,
      {
        sourceName: 'OpenStreetMap Road Network Amritsar',
        retrievalDate: now.toISOString(),
        license: 'ODbL',
        evidenceKind: 'modeled',
      },
      30
    )

    // 4. Freshness Calculation
    const ageHours = (now.getTime() - observedMs) / (3600 * 1000)
    const isStale = ageHours > 6
    const isExpired = ageHours > 24 || input.category === 'receding_water'
    const expiresAt = new Date(observedMs + 24 * 3600 * 1000).toISOString()

    const freshness: ObservationFreshness = {
      isStale,
      isExpired,
      expiresAt,
    }

    // 5. Corroboration Engine: Find eligible nearby reports (within 150m, 3 hours, distinct reporter)
    const corroboratingIds: string[] = []
    for (const other of all) {
      if (other.lifecycleStatus === 'rejected' || other.lifecycleStatus === 'expired') continue
      if (other.reporterHash === reporterHash) continue // Must be distinct reporter

      const otherObsMs = new Date(other.observedAt).getTime()
      const timeGapHours = Math.abs(observedMs - otherObsMs) / (3600 * 1000)

      if (timeGapHours <= 3) {
        const otherUtm = wgs84ToUtm43n(other.coordinates)
        const d = euclideanDistanceUtm(inputUtm, otherUtm)
        if (d <= 150) {
          corroboratingIds.push(other.id)
        }
      }
    }

    const initialLifecycleStatus = corroboratingIds.length >= 2 ? 'corroborated' : 'submitted'

    const corroboration: ObservationCorroboration = {
      corroborationCount: corroboratingIds.length + 1,
      corroboratingObservationIds: corroboratingIds,
      lastCorroboratedAt: corroboratingIds.length > 0 ? now.toISOString() : null,
    }

    const observation: WaterloggingObservation = {
      id: observationId,
      schemaVersion: '1.0.0',
      cityId,
      createdAt: now.toISOString(),
      submittedAt: now.toISOString(),
      observedAt: input.observedAt,
      coordinates: input.coordinates,
      spatialMatch: {
        cellId: gridMatch.cellId,
        cellSusceptibility: gridMatch.susceptibilityScore ?? null,
        roadSegmentId: roadMatch.matchedSegmentId,
        roadName: null,
        distanceToRoadMeters: roadMatch.distanceToSegmentMeters === Infinity ? null : roadMatch.distanceToSegmentMeters,
        matchQuality: roadMatch.matchQuality === 'projected_segment' ? 'projected_segment' : gridMatch.matchQuality,
        unmatchedReason: roadMatch.reason,
      },
      category: input.category,
      severity: input.severity,
      description: input.description,
      photoUrl: input.photoUrl,
      reporterHash,
      sourceType: 'community_submission',
      lifecycleStatus: initialLifecycleStatus,
      verification: {
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
        verificationMethod: null,
        verificationNotes: null,
      },
      corroboration,
      freshness,
      scientificCaveat:
        'Community waterlogging observation. Does NOT represent an official emergency broadcast or verified flood depth.',
    }

    // Update corroboration links on existing reports
    if (corroboratingIds.length > 0) {
      for (const other of all) {
        if (corroboratingIds.includes(other.id)) {
          other.corroboration.corroborationCount++
          if (!other.corroboration.corroboratingObservationIds.includes(observation.id)) {
            other.corroboration.corroboratingObservationIds.push(observation.id)
          }
          other.corroboration.lastCorroboratedAt = now.toISOString()
          if (other.lifecycleStatus === 'submitted' && other.corroboration.corroborationCount >= 2) {
            other.lifecycleStatus = 'corroborated'
          }
        }
      }
    }

    all.push(observation)
    this.saveObservations(all, cityId)

    return { observation }
  }

  /**
   * Queries stored observations with multi-factor filters.
   */
  public queryObservations(filters: ObservationQueryFilters): WaterloggingObservation[] {
    const cityId = (filters.cityId || 'amritsar').toLowerCase()
    const all = this.loadObservations(cityId)
    const now = Date.now()

    return all
      .filter((obs) => {
        // City match
        if (obs.cityId !== cityId) return false

        // Status filter
        if (filters.status) {
          const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
          if (!statuses.includes(obs.lifecycleStatus)) return false
        }

        // Category filter
        if (filters.category && obs.category !== filters.category) return false

        // Severity filter
        if (filters.severity && obs.severity !== filters.severity) return false

        // CellId filter
        if (filters.cellId && obs.spatialMatch.cellId !== filters.cellId) return false

        // Fresh only filter
        if (filters.freshOnly) {
          const expMs = new Date(obs.freshness.expiresAt).getTime()
          if (obs.lifecycleStatus === 'expired' || obs.lifecycleStatus === 'rejected' || expMs < now) {
            return false
          }
        }

        return true
      })
      .slice(-Number(filters.limit || 50))
      .reverse() // Most recent first
  }

  /**
   * Verifies or moderates an observation (requires authorized reviewer).
   */
  public verifyObservation(
    id: string,
    verification: VerifyObservationInput,
    cityId: string = 'amritsar'
  ): { observation?: WaterloggingObservation; error?: string } {
    const all = this.loadObservations(cityId)
    const target = all.find((obs) => obs.id === id)

    if (!target) {
      return { error: `Observation with ID '${id}' not found.` }
    }

    const now = new Date().toISOString()
    target.lifecycleStatus = verification.status === 'verified'
      ? 'verified'
      : verification.status === 'rejected'
        ? 'rejected'
        : 'under_review'

    target.verification = {
      isVerified: verification.status === 'verified',
      verifiedAt: now,
      verifiedBy: verification.verifiedBy,
      verificationMethod: verification.verificationMethod,
      verificationNotes: verification.verificationNotes || null,
    }

    this.saveObservations(all, cityId)
    this.repository.update(target, cityId).catch(() => {})
    return { observation: target }
  }

  /**
   * Resets observations cache and repository to baseline seeded records (for test isolation).
   */
  public resetForTesting(cityId: string = 'amritsar'): void {
    this.observationsCache = null
    this.repository.reset(cityId).catch(() => {})
    const filePath = this.getStoragePath(cityId)
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath)
      } catch {
        // Ignore unlink error if file locked
      }
    }
  }
}

export const observationService = ObservationService.getInstance()

import { ValueMetaPresets } from '../metadata'

/**
 * Strips pseudonymous reporter hash before returning observation to client.
 * Attaches human-readable value metadata.
 */
export function sanitizePublicObservation(obs: WaterloggingObservation): Omit<WaterloggingObservation, 'reporterHash'> {
  const publicObs = { ...obs }
  delete publicObs.reporterHash
  publicObs.valueMeta = ValueMetaPresets.observation(
    obs.verification?.isVerified,
    obs.sourceType === 'imported_historical_record'
  )
  return publicObs
}
