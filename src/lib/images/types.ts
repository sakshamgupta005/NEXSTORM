/**
 * src/lib/images/types.ts
 * Image Evidence & AI Vision Data Contracts for NEXSTORM.
 *
 * Implements real AI-based image analysis feeding the existing building-exposure
 * and road/route-risk systems.
 *
 * Scientific Guardrails:
 * 1. Do not let an LLM directly invent an arbitrary final risk score; map visual
 *    observations to risk features using deterministic application code.
 * 2. Model confidence is NOT automatically a calibrated probability.
 * 3. Do not claim exact water depth from ordinary photographs.
 * 4. Do not infer GPS coordinates or building identity from image appearance.
 * 5. Clearly distinguish historical baseline imagery from active flood conditions.
 * 6. Ambiguous, corrupted, or failed provider outputs must NEVER be turned into
 *    fabricated positive or negative observations.
 */

import type { ProvenanceMetadata, Wgs84Coordinates } from '../spatial/types'

export type ImageSourceType =
  | 'mapillary'
  | 'citizen_field_submission'
  | 'incident_report_archive'
  | 'sentinel_satellite'

export type ImageProcessingStatus =
  | 'pending'
  | 'analyzed'
  | 'verified_flooded'
  | 'verified_clear'
  | 'inconclusive'
  | 'corrupted'
  | 'provider_error'
  | 'blocked'

export type WaterDepthProxy =
  | 'none'
  | 'curb_ponding'
  | 'ankle_deep'
  | 'knee_or_higher'
  | 'impassable'

export type FloodPassability = 'passable' | 'caution' | 'impassable'

export type SceneType = 'street_level' | 'aerial' | 'satellite' | 'unknown'

export type RoadWaterCondition =
  | 'none'
  | 'curb_ponding'
  | 'flowing_surface_water'
  | 'deep_standing_water'
  | 'submerged'

export type BuildingWaterImpact =
  | 'none'
  | 'water_at_perimeter'
  | 'entrance_doorstep_inundation'
  | 'ground_floor_flooded'
  | 'unknown'

export type WaterExtent =
  | 'none'
  | 'localized_spot'
  | 'corridor_linear'
  | 'areal_broad'
  | 'unknown'

export type ImageQuality = 'high' | 'adequate' | 'poor_blurry_dark' | 'occluded'

export type OcclusionDegree = 'none' | 'partial' | 'heavy'

export type UncertaintyLevel = 'low' | 'moderate' | 'high' | 'unusable'

/**
 * Structured visual observations extracted by AI vision models or deterministic analyzers.
 */
export interface StructuredVisualObservation {
  sceneType: SceneType
  visibleWaterOnRoad: boolean
  roadWaterCondition: RoadWaterCondition
  roadPassability: FloodPassability
  visibleWaterAffectingBuilding: boolean
  buildingWaterImpact: BuildingWaterImpact
  waterExtent: WaterExtent
  imageQuality: ImageQuality
  occlusionDegree: OcclusionDegree
  uncertaintyLevel: UncertaintyLevel
  rawEvidenceExplanation: string
  modelConfidence: number // Raw model confidence [0.0, 1.0]
  modelUsed: string
  providerUsed: string
  segmentationSupported: boolean
  extractedAt: string
}

/**
 * Validated, versioned internal risk features produced from visual observations
 * by deterministic application code (never an ungrounded LLM score).
 */
export interface VisualRiskFeaturesV1 {
  schemaVersion: '1.0.0'
  imageId: string
  visualSeverity: 'none' | 'low_ponding' | 'moderate_flow' | 'severe_inundation'
  evidenceQuality: 'high' | 'moderate' | 'low' | 'unusable'
  geographicRelevance: 'exact_segment_and_parcel' | 'grid_cell_macro' | 'unlocated'
  temporalRelevance: 'active_event_hazard' | 'historical_vulnerability_only' | 'stale_unusable'
  currentRoadRiskElevation: 'none' | 'moderate' | 'high'
  currentBuildingExposureElevation: 'none' | 'moderate_catchment' | 'high_catchment'
  routeImpedancePenalty: number // Deterministic penalty points [0, 30]
  calibratedWeight: number // Calibrated evidence weight [0.0, 1.0]
  isActionable: boolean // False if occluded, unusable, unlocated, or corrupted
  generatedAt: string
  provenance: ProvenanceMetadata
  scientificCaveat: string
}

/**
 * FloodNet-adapted scene understanding classification contract.
 * Based on BinaLab/FloodNet-Supervised_v1.0 & sahilkhose/FloodNet taxonomy.
 */
export interface FloodNetClassification {
  waterDetected: boolean
  floodedRoad: boolean
  floodedBuilding: boolean
  waterCoverFraction: number // Estimated surface fraction [0.0, 1.0]
  estimatedWaterDepth: WaterDepthProxy
  passability: FloodPassability
  confidence: number // Classifier confidence [0.0, 1.0]
  detectedClasses: string[]
  analyzedAt: string
}

/**
 * Vision provider execution result.
 */
export interface VisionProviderResult {
  status: 'ok' | 'provider_error' | 'unconfigured' | 'corrupted_image'
  observation?: StructuredVisualObservation
  error?: string
  provider: string
  model: string
  latencyMs: number
}

/**
 * Core image evidence record.
 */
export interface ImageEvidenceRecord {
  id: string
  source: ImageSourceType
  imageUrl: string
  thumbnailUrl?: string
  capturedAt: string // ISO timestamp of camera exposure
  ingestedAt: string // ISO timestamp of system ingestion
  coordinates: Wgs84Coordinates
  geographicAccuracyMeters: number
  cityId: string

  // Spatial bindings to existing infrastructure
  cellId?: string
  roadSegmentId?: string
  buildingId?: string

  // Legal rights & provenance
  attribution: string
  license: string
  contentHash: string // SHA-256 hash of image data / canonical representation
  processingStatus: ImageProcessingStatus

  // Temporal role: historical surveys vs active storm events
  isHistorical: boolean

  // Extracted structured observation and deterministic risk features
  observation?: StructuredVisualObservation
  riskFeatures?: VisualRiskFeaturesV1

  // Backward-compatible classification
  analysis: FloodNetClassification

  provenance: ProvenanceMetadata
  scientificCaveat: string
}

/**
 * Satellite remote-sensing suitability assessment contract.
 */
export interface SatelliteSuitabilityAssessment {
  sensor: string
  constellation: string
  spatialResolutionM: number
  revisitIntervalDays: number
  cloudPenetration: boolean
  urbanStreetFeasibility: 'unsuitable' | 'partially_suitable' | 'suitable'
  rationale: string
  limitations: string[]
  recommendedUsage: string
  assessedAt: string
}

/**
 * Mapillary API query options and response contracts.
 */
export interface MapillaryQueryOptions {
  bbox: [number, number, number, number] // [minLng, minLat, maxLng, maxLat]
  limit?: number
  cityId?: string
}

export interface MapillaryQueryResult {
  status: 'ok' | 'blocked' | 'error'
  reason?: string
  totalFetched: number
  images: ImageEvidenceRecord[]
  rateLimitRemaining?: number
}

/**
 * Summary representation of image evidence attached to a road segment.
 */
export interface RoadImageEvidenceSummary {
  imageId: string
  source: ImageSourceType
  capturedAt: string
  isHistorical: boolean
  floodedRoad: boolean
  passability: FloodPassability
  confidence: number
  thumbnailUrl?: string
  riskFeatures?: VisualRiskFeaturesV1
  distanceMeters?: number
}

/**
 * Summary representation of image evidence attached to a building.
 */
export interface BuildingImageEvidenceSummary {
  imageId: string
  source: ImageSourceType
  capturedAt: string
  isHistorical: boolean
  floodedBuilding: boolean
  waterDetected: boolean
  confidence: number
  thumbnailUrl?: string
  riskFeatures?: VisualRiskFeaturesV1
  distanceMeters?: number
}
