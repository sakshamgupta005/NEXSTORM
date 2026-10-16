/**
 * src/lib/spatial/types.ts
 * Core spatial data types, coordinate reference system contracts,
 * matching quality metadata, and unified risk product contracts for NEXSTORM.
 */

import type { RiskClass } from '../risk/types'

// Coordinate Reference Systems
export interface Wgs84Coordinates {
  lng: number // Longitude in decimal degrees [-180, 180]
  lat: number // Latitude in decimal degrees [-90, 90]
}

export interface UtmCoordinates {
  easting: number // Meters east in UTM Zone 43N
  northing: number // Meters north in UTM Zone 43N
  zone: 43
  hemisphere: 'N'
}

export interface BoundingBoxWgs84 {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
}

// Spatial Match Quality
export type SpatialMatchQuality =
  | 'exact_inside' // Point strictly inside polygon
  | 'boundary_touch' // Point on or within 1m of polygon edge
  | 'centroid_inside' // Polygon/building centroid is inside container cell
  | 'intersects' // Polygon/line intersects cell boundary
  | 'projected_segment' // Observation projected onto road centerline within tolerance
  | 'buffer_proximity' // Matched within specified distance threshold
  | 'unmatched' // Point/geometry exceeds tolerance or outside boundary

// Evidence Modality
export type EvidenceKind = 'modeled' | 'observed' | 'reanalysis_replay' | 'simulated_scenario'
export type VerificationStatus = 'unverified_citizen' | 'corroborated_community' | 'verified_news' | 'official_authority'

export interface ProvenanceMetadata {
  sourceName: string
  sourceUrl?: string
  retrievalDate: string
  license: string
  evidenceKind: EvidenceKind
  verificationStatus?: VerificationStatus
  imputationNotice?: string
}

// Point to Grid Match Result
export interface PointGridMatch {
  point: Wgs84Coordinates
  cellId: string | null
  matchQuality: SpatialMatchQuality
  susceptibilityScore: number | null
  distanceToCentroidMeters: number | null
  provenance: ProvenanceMetadata
  limitation?: string
}

// Building Exposure Assessment Contract
export interface BuildingExposureAssessment {
  buildingId: string
  osmid?: string
  name?: string
  buildingType?: string
  centroid: Wgs84Coordinates
  areaM2?: number
  matchedCellId: string | null
  matchQuality: SpatialMatchQuality
  cellSusceptibility: number | null
  modeledRiskClass: RiskClass | null
  nearestIncidentDistanceM: number | null
  provenance: ProvenanceMetadata
  scientificCaveat: string
}

// Road Segment Risk Assessment Contract
export interface RoadSegmentRiskAssessment {
  segmentId: string
  osmid: string
  roadName: string | null
  highwayClassification: string
  lengthMeters: number
  startCoord: Wgs84Coordinates
  endCoord: Wgs84Coordinates
  intersectingCellIds: string[]
  maxCellSusceptibility: number
  modeledRiskClass: RiskClass
  activeReportsCount: number
  isUnderpassProxy: boolean
  matchQuality: SpatialMatchQuality
  provenance: ProvenanceMetadata
  scientificCaveat: string
}

// Road Observation Match Result
export interface RoadObservationMatch {
  observationId: string
  originalCoord: Wgs84Coordinates
  matchedSegmentId: string | null
  snappedCoord: Wgs84Coordinates | null
  distanceToSegmentMeters: number
  fractionAlongSegment: number | null // 0.0 (start) to 1.0 (end)
  matchQuality: SpatialMatchQuality
  toleranceMeters: number
  provenance: ProvenanceMetadata
  reason?: string
}

// Flood-Aware Routing Evaluation Contracts
export interface RouteSegmentExposure {
  segmentId: string
  roadName: string | null
  highwayType: string
  lengthMeters: number
  riskClass: RiskClass
  susceptibility: number
  hasActiveReport: boolean
  underpassAlert: boolean
  hasActiveImageEvidence?: boolean
}

export interface RouteRiskEvaluation {
  routeId: string
  origin: Wgs84Coordinates
  destination: Wgs84Coordinates
  totalDistanceMeters: number
  estimatedDurationSeconds: number
  segments: RouteSegmentExposure[]
  exposureBreakdown: {
    lowRiskDistanceM: number
    moderateRiskDistanceM: number
    highRiskDistanceM: number
    highRiskPercentage: number
    underpassCountOnRoute: number
    activeReportsOnRoute: number
  }
  compositeRiskScore: number // Scaled 0 to 100 risk penalty score
  recommendation: 'standard_advisory' | 'caution_moderate_exposure' | 'warning_high_waterlogging_risk'
  routingDisclaimer: string
}
