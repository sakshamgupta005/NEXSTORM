/**
 * src/lib/roads/types.ts
 * Road network data models, multi-cell spatial hazard contracts,
 * dynamic road-risk evaluation, and flood-aware routing foundation for NEXSTORM.
 */

import type { RiskClass } from '../risk/types'
import type { RouteSegmentExposure, Wgs84Coordinates } from '../spatial/types'

export interface CellIntersection {
  cellId: string
  s: number
  lengthM: number
  fraction: number // fraction of segment length inside this cell [0.0, 1.0]
}

export interface RoadSegmentRecord {
  segmentId: string
  osmid: string
  name: string
  highway: string
  lengthM: number
  isUnderpass: boolean
  isBridge: boolean
  fromNode: number
  toNode: number
  primaryCellId: string
  maxCellSusceptibility: number
  weightedCellSusceptibility: number
  unmatchedFraction: number
  modeledRiskClass: RiskClass
  intersectingCells: CellIntersection[]
  startCoord: Wgs84Coordinates
  endCoord: Wgs84Coordinates
  geometry?: {
    type: 'LineString'
    coordinates: [number, number][]
  }
}

export interface RoadObservationEvidence {
  observationId: string
  category: string
  severity: string
  observedAt: string
  lifecycleStatus: string
  isVerified: boolean
  verificationMethod: string | null
  corroborationCount: number
  distanceMeters: number | null
}

export interface EvaluatedRoadSegmentRisk {
  segmentId: string
  osmid: string
  name: string
  highway: string
  lengthM: number
  isUnderpass: boolean
  isBridge: boolean
  fromNode: number
  toNode: number
  primaryCellId: string
  maxCellSusceptibility: number
  weightedCellSusceptibility: number
  unmatchedFraction: number
  modeledRiskClass: RiskClass
  dynamicRiskClass: RiskClass // Evaluated dynamically against rainfall & ground observations
  activeObservationsCount: number
  hasVerifiedIncident: boolean
  observations: RoadObservationEvidence[]
  startCoord: Wgs84Coordinates
  endCoord: Wgs84Coordinates
  geometry: {
    type: 'LineString'
    coordinates: [number, number][]
  }
  intersectingCells: CellIntersection[]
  scientificCaveat: string
}

export interface RoadRiskQueryFilters {
  cityId?: string
  bbox?: [number, number, number, number] // [minLng, minLat, maxLng, maxLat]
  minLng?: number
  minLat?: number
  maxLng?: number
  maxLat?: number
  highway?: string | string[]
  riskClass?: RiskClass | RiskClass[]
  hasObservation?: boolean
  isUnderpass?: boolean
  hasUnderpass?: boolean
  limit?: number
  offset?: number
}

export interface RoadGraphNode {
  nodeId: number
  lat: number
  lng: number
  degree: number
}

export interface RoadGraphEdge {
  segmentId: string
  fromNode: number
  toNode: number
  lengthM: number
  highway: string
  isUnderpass: boolean
  isBridge: boolean
  maxS: number
  riskClass: RiskClass
}

export interface RoadNetworkGraph {
  cityId: string
  totalNodes: number
  totalEdges: number
  junctionNodesCount: number
  nodes: Record<string, [number, number]> // nodeId -> [lng, lat]
  edges: RoadGraphEdge[]
}

export interface CandidateRouteInput {
  routeId: string
  name?: string
  description?: string
  segmentIds?: string[]
  coordinates?: [number, number][]
}

export interface CandidateRouteEvaluation {
  routeId: string
  name: string
  totalDistanceKm: number
  totalDistanceMeters: number
  matchedSegmentsCount: number
  exposureByClass: {
    high: number
    moderate: number
    low: number
  }
  underpassCrossings: number
  activeObservationCount: number
  compositePenaltyScore: number
  recommendation: 'recommended' | 'caution' | 'avoid'
  segments: RouteSegmentExposure[]
}

export interface RouteComparisonResult {
  safestRouteId: string
  comparisonSummary: {
    totalRoutesCompared: number
    safestRouteName: string
  }
  rankedRoutes: CandidateRouteEvaluation[]
}
