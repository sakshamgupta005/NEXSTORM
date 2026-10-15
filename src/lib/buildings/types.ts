/**
 * src/lib/buildings/types.ts
 * Building footprint exposure contracts, multi-cell intersection models,
 * and API query filters for NEXSTORM.
 *
 * Core scientific guardrail:
 * Clearly distinguishes area susceptibility (grid runoff propensity),
 * building exposure (spatial footprint overlap with hazard zones), and
 * building structural vulnerability (NOT claimed/invented; structural plinth/damage omitted).
 */

import type { ProvenanceMetadata, Wgs84Coordinates } from '../spatial/types'

export type BuildingExposureCategory =
  | 'high_catchment' // Footprint intersects high-susceptibility cell (s >= 0.66)
  | 'moderate_catchment' // Footprint intersects moderate-susceptibility cell (0.33 <= s < 0.66)
  | 'low_catchment' // Footprint intersects low-susceptibility cell (s < 0.33)
  | 'unmatched' // Footprint extends beyond municipal grid boundary

export interface BuildingCellIntersection {
  cellId: string
  susceptibility: number
  intersectionAreaM2: number
  fraction: number // Proportion of footprint area inside this cell [0.0, 1.0]
}

export interface BuildingExposureRecord {
  buildingId: string
  source: string
  license: string
  confidence: number
  areaM2: number
  centroid: Wgs84Coordinates
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
  primaryCellId: string
  intersectingCells: BuildingCellIntersection[]
  weightedSusceptibility: number
  maxCellSusceptibility: number // Conservative spatial exposure indicator
  unmatchedFraction: number // Proportion of footprint outside grid extent
  exposureCategory: BuildingExposureCategory
  provenance: ProvenanceMetadata
  scientificCaveat: string
}

export interface BuildingQueryFilters {
  cityId?: string
  cellId?: string
  bbox?: [number, number, number, number] // [minLng, minLat, maxLng, maxLat]
  minLng?: number
  minLat?: number
  maxLng?: number
  maxLat?: number
  exposureCategory?: BuildingExposureCategory | BuildingExposureCategory[]
  minAreaM2?: number
  maxAreaM2?: number
  limit?: number
  offset?: number
}

export interface CellBuildingSummary {
  cellId: string
  buildingCount: number
  totalFootprintAreaM2: number
  meanFootprintAreaM2: number
  highConfidenceCount: number
  meanConfidence: number
  exposureCategory: BuildingExposureCategory
}
