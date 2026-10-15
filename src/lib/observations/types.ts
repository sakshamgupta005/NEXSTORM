/**
/**
 * src/lib/observations/types.ts
 * Canonical observation schemas and lifecycle data contracts for NEXSTORM.
 * Amritsar ground-truth observations, community reports, and verification history.
 */

import type { SpatialMatchQuality, Wgs84Coordinates } from '../spatial/types'

export type WaterloggingCategory =
  | 'ponding'
  | 'street_flooding'
  | 'underpass_submersion'
  | 'drain_overflow'
  | 'receding_water'

export type WaterloggingSeverity =
  | 'minor_curb' // Water accumulated at curbs/gutters; passable for all vehicles
  | 'moderate_ankle' // Ankle-deep (~10-20 cm); slow traffic, two-wheelers affected
  | 'severe_knee_or_higher' // Knee-deep (>30 cm); impassable for sedans/two-wheelers
  | 'impassable_vehicles' // Submerged; buses/trucks stuck, road completely impassable

export type ObservationSourceType =
  | 'community_submission'
  | 'authorized_field_observer'
  | 'imported_historical_record'
  | 'municipal_report'

export type ObservationLifecycleStatus =
  | 'submitted'
  | 'under_review'
  | 'corroborated'
  | 'verified'
  | 'rejected'
  | 'expired'

export type VerificationMethod =
  | 'field_inspection'
  | 'traffic_police_notice'
  | 'news_report'
  | 'sensor_telemetry'
  | 'municipal_advisory'

export interface VerificationRecord {
  isVerified: boolean
  verifiedAt: string | null
  verifiedBy: string | null // Redacted agency/operator ID
  verificationMethod: VerificationMethod | null
  verificationNotes: string | null
}

export interface ObservationSpatialMatch {
  cellId: string | null
  cellSusceptibility: number | null
  roadSegmentId: string | null
  roadName: string | null
  distanceToRoadMeters: number | null
  matchQuality: SpatialMatchQuality
  unmatchedReason?: string
}

export interface ObservationCorroboration {
  corroborationCount: number
  corroboratingObservationIds: string[]
  lastCorroboratedAt: string | null
}

export interface ObservationFreshness {
  isStale: boolean // Event > 6 hours old
  isExpired: boolean // Event > 24 hours old or cleared
  expiresAt: string
}

export interface WaterloggingObservation {
  id: string
  schemaVersion: '1.0.0'
  cityId: string

  // Timestamps
  createdAt: string // Client report creation timestamp
  submittedAt: string // Server ingest timestamp
  observedAt: string // Physical observation timestamp

  // Location & Spatial Binding
  coordinates: Wgs84Coordinates
  spatialMatch: ObservationSpatialMatch

  // Core Observation
  category: WaterloggingCategory
  severity: WaterloggingSeverity
  description?: string
  photoUrl?: string

  // Reporter Reference (strictly pseudonymous, zero PII, omitted from public API responses)
  reporterHash?: string
  sourceType: ObservationSourceType

  // Lifecycle & Trust
  lifecycleStatus: ObservationLifecycleStatus
  verification: VerificationRecord
  corroboration: ObservationCorroboration
  freshness: ObservationFreshness

  // Permanent Scientific Caveat
  scientificCaveat: string
}

/**
 * Payload submitted by clients.
 * Protected fields (verification, corroboration, submittedAt) are strictly omitted.
 */
export interface CreateObservationInput {
  cityId?: string
  coordinates: Wgs84Coordinates
  observedAt: string
  category: WaterloggingCategory
  severity: WaterloggingSeverity
  description?: string
  photoUrl?: string
}

export interface VerifyObservationInput {
  status: 'verified' | 'rejected' | 'under_review'
  verifiedBy: string
  verificationMethod: VerificationMethod
  verificationNotes?: string
}

export interface ObservationQueryFilters {
  cityId?: string
  status?: ObservationLifecycleStatus | ObservationLifecycleStatus[]
  category?: WaterloggingCategory
  severity?: WaterloggingSeverity
  cellId?: string
  roadSegmentId?: string
  freshOnly?: boolean
  limit?: number
}
