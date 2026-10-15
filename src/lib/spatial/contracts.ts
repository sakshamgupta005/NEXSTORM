/**
 * src/lib/spatial/contracts.ts
 * Implements shared risk product builders and flood-aware route evaluation algorithms
 * with explicit separation between hazard, exposure, and observations.
 */

import type { RiskClass } from '../risk/types'
import type {
  BuildingExposureAssessment,
  ProvenanceMetadata,
  RoadSegmentRiskAssessment,
  RouteRiskEvaluation,
  RouteSegmentExposure,
  SpatialMatchQuality,
  Wgs84Coordinates,
} from './types'

export interface RawBuildingInput {
  buildingId: string
  osmid?: string
  name?: string
  buildingType?: string
  centroid: Wgs84Coordinates
  areaM2?: number
}

export interface CellHazardContext {
  cellId: string
  susceptibilityScore: number
  modeledRiskClass: RiskClass
}

/**
 * Builds a typed BuildingExposureAssessment ensuring no unsupported structural or indoor depth claims are made.
 */
export function buildBuildingExposureAssessment(
  building: RawBuildingInput,
  cellContext: CellHazardContext | null,
  matchQuality: SpatialMatchQuality,
  nearestIncidentDistanceM: number | null,
  provenance: ProvenanceMetadata
): BuildingExposureAssessment {
  return {
    buildingId: building.buildingId,
    osmid: building.osmid,
    name: building.name,
    buildingType: building.buildingType || 'unclassified',
    centroid: building.centroid,
    areaM2: building.areaM2,
    matchedCellId: cellContext ? cellContext.cellId : null,
    matchQuality,
    cellSusceptibility: cellContext ? cellContext.susceptibilityScore : null,
    modeledRiskClass: cellContext ? cellContext.modeledRiskClass : null,
    nearestIncidentDistanceM,
    provenance,
    scientificCaveat:
      'Exposure assessment reflects spatial intersection with terrain susceptibility. It does NOT predict indoor water ingress, floor inundation depth, or structural damage.',
  }
}

/**
 * Builds a typed RoadSegmentRiskAssessment combining intersecting cell hazards and reported incidents.
 */
export function buildRoadSegmentRiskAssessment(
  segment: {
    segmentId: string
    osmid: string
    roadName: string | null
    highwayClassification: string
    lengthMeters: number
    startCoord: Wgs84Coordinates
    endCoord: Wgs84Coordinates
    isUnderpassProxy?: boolean
  },
  intersectingCells: CellHazardContext[],
  activeReportsCount: number,
  matchQuality: SpatialMatchQuality,
  provenance: ProvenanceMetadata
): RoadSegmentRiskAssessment {
  const maxS = intersectingCells.length > 0
    ? Math.max(...intersectingCells.map((c) => c.susceptibilityScore))
    : 0.0

  // Worst-case risk class along the segment
  let worstRisk: RiskClass = 'low'
  if (intersectingCells.some((c) => c.modeledRiskClass === 'high')) {
    worstRisk = 'high'
  } else if (intersectingCells.some((c) => c.modeledRiskClass === 'moderate')) {
    worstRisk = 'moderate'
  }

  return {
    segmentId: segment.segmentId,
    osmid: segment.osmid,
    roadName: segment.roadName,
    highwayClassification: segment.highwayClassification,
    lengthMeters: segment.lengthMeters,
    startCoord: segment.startCoord,
    endCoord: segment.endCoord,
    intersectingCellIds: intersectingCells.map((c) => c.cellId),
    maxCellSusceptibility: Math.round(maxS * 1000) / 1000,
    modeledRiskClass: worstRisk,
    activeReportsCount,
    isUnderpassProxy: Boolean(segment.isUnderpassProxy),
    matchQuality,
    provenance,
    scientificCaveat:
      'Road segment risk indicates modeled corridor susceptibility and documented reports. It does NOT guarantee current passage status or real-time flood depth.',
  }
}

/**
 * Evaluates flood-aware risk exposure along a candidate route.
 * Combines distance exposure, verified report blockages, and underpass proxies.
 */
export function evaluateRouteRisk(
  routeId: string,
  origin: Wgs84Coordinates,
  destination: Wgs84Coordinates,
  segments: RouteSegmentExposure[],
  estimatedDurationSeconds: number
): RouteRiskEvaluation {
  let totalDistanceMeters = 0
  let lowRiskDistanceM = 0
  let moderateRiskDistanceM = 0
  let highRiskDistanceM = 0
  let underpassCountOnRoute = 0
  let activeReportsOnRoute = 0

  for (const seg of segments) {
    totalDistanceMeters += seg.lengthMeters

    if (seg.riskClass === 'high') {
      highRiskDistanceM += seg.lengthMeters
    } else if (seg.riskClass === 'moderate') {
      moderateRiskDistanceM += seg.lengthMeters
    } else {
      lowRiskDistanceM += seg.lengthMeters
    }

    if (seg.underpassAlert) {
      underpassCountOnRoute++
    }

    if (seg.hasActiveReport) {
      activeReportsOnRoute++
    }
  }

  const highRiskPercentage = totalDistanceMeters > 0
    ? Math.round((highRiskDistanceM / totalDistanceMeters) * 1000) / 10
    : 0

  // Composite Risk Penalty Score (0 to 100):
  // Base risk: 40% from high-risk distance fraction, 20% from moderate-risk fraction
  // Additive penalties: 20 points per active report (up to 40), 10 points per underpass (up to 20)
  const highRatio = totalDistanceMeters > 0 ? highRiskDistanceM / totalDistanceMeters : 0
  const modRatio = totalDistanceMeters > 0 ? moderateRiskDistanceM / totalDistanceMeters : 0

  const basePenalty = highRatio * 40 + modRatio * 20
  const reportPenalty = Math.min(40, activeReportsOnRoute * 20)
  const underpassPenalty = Math.min(20, underpassCountOnRoute * 10)

  const rawScore = basePenalty + reportPenalty + underpassPenalty
  const compositeRiskScore = Math.min(100, Math.round(rawScore))

  let recommendation: RouteRiskEvaluation['recommendation'] = 'standard_advisory'
  if (compositeRiskScore >= 50 || activeReportsOnRoute > 0) {
    recommendation = 'warning_high_waterlogging_risk'
  } else if (compositeRiskScore >= 25 || highRiskPercentage > 15) {
    recommendation = 'caution_moderate_exposure'
  }

  return {
    routeId,
    origin,
    destination,
    totalDistanceMeters,
    estimatedDurationSeconds,
    segments,
    exposureBreakdown: {
      lowRiskDistanceM,
      moderateRiskDistanceM,
      highRiskDistanceM,
      highRiskPercentage,
      underpassCountOnRoute,
      activeReportsOnRoute,
    },
    compositeRiskScore,
    recommendation,
    routingDisclaimer:
      'Experimental flood-aware route comparison. Does not guarantee impassability or safety. Always heed local signage and official emergency advisories.',
  }
}
