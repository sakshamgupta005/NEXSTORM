/**
 * src/lib/risk/explain.ts
 * Explains cell-level susceptibility factor contributions, nearby validated incident hotspots,
 * and scientific limitations.
 */

import fs from 'node:fs'
import path from 'node:path'
import {
  getCityCampusSusceptibility,
  getCityConfig,
  getCityHotspots,
  getCitySusceptibility,
  isCitySupported,
  type HotspotRecord,
  type SusceptibilityFeature,
} from '../city/registry'
import { sBand } from './matrix'
import type { SBand } from './types'
import { ValueMeta, ValueMetaPresets } from '../metadata'

export interface FactorContribution {
  factor: string
  label: string
  featureValue: number
  appliedWeight: number
  contribution: number
}

export interface NearbyHotspotResult {
  id: string
  name: string
  distanceMeters: number
  articleDate: string | null
  sourceUrl: string | null
  evidence: string
  precision: string
}

export interface CellBuildingExposure {
  buildingCount: number
  totalFootprintAreaM2: number
  meanFootprintAreaM2: number
  highConfidenceCount: number
  exposureCategory: 'minimal' | 'moderate_catchment' | 'high_catchment' | 'none'
  scientificCaveat: string
}

export interface CellExplanation {
  cellId: string
  cityId: string
  sValue: number
  sBand: SBand
  nearestRoad?: string
  factorContributions: FactorContribution[]
  terrainOverride: {
    applied: boolean
    reason: string
    note?: string
  }
  nearbyHotspot: NearbyHotspotResult | null
  buildingExposure?: CellBuildingExposure
  provenance: {
    elevationSource: string
    landCoverSource: string
    roadSource: string
    evidenceClass: string
    methodology: string
  }
  valueMeta: Record<string, ValueMeta>
  limitations: string[]
}

export const EXPLANATION_LIMITATIONS: string[] = [
  'Coarse, approximately 10–25 km rainfall input.',
  'Proxy susceptibility features.',
  'No verified drainage-network data.',
  'News-derived hotspot evidence.',
]

const FACTOR_METADATA: Record<string, { key: string; label: string; weightKey: string }> = {
  builtUp: {
    key: 'f_builtUp',
    label: 'Dense built-up area',
    weightKey: 'builtUp',
  },
  depression: {
    key: 'f_depression',
    label: 'Lower than surroundings (relative)',
    weightKey: 'depression',
  },
  flatness: {
    key: 'f_flatness',
    label: 'Flat terrain (slow surface runoff)',
    weightKey: 'flatness',
  },
  lowPoint: {
    key: 'f_lowPoint',
    label: 'Underpass nearby',
    weightKey: 'lowPoint',
  },
  densityProxy: {
    key: 'f_density',
    label: 'Small, dense building fabric (proxy for drainage pressure)',
    weightKey: 'densityProxy',
  },
}

/**
 * Calculates Great-Circle distance between two points in metres using Haversine formula.
 */
export function haversineDistanceM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // metres
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return Math.round(R * c)
}

/**
 * Computes polygon centroid [lat, lon] from coordinates.
 */
export function getCellCentroid(feature: SusceptibilityFeature): [number, number] {
  const coords = feature.geometry.coordinates[0]
  if (!coords || coords.length === 0) {
    return [0, 0]
  }

  let sumLat = 0
  let sumLon = 0
  const count = coords.length

  for (const [lon, lat] of coords) {
    sumLat += lat
    sumLon += lon
  }

  return [sumLat / count, sumLon / count]
}

/**
 * Finds the nearest hotspot within the specified radius (default 500m).
 */
export function findNearbyHotspot(
  cellFeature: SusceptibilityFeature,
  hotspots: HotspotRecord[],
  maxRadiusM: number = 500
): NearbyHotspotResult | null {
  if (!hotspots || hotspots.length === 0) return null

  const [cellLat, cellLon] = getCellCentroid(cellFeature)
  let nearest: HotspotRecord | null = null
  let minDistance = Infinity

  for (const spot of hotspots) {
    // If the hotspot is directly assigned to this cellId, distance is considered 0 or centroid distance
    let dist = haversineDistanceM(cellLat, cellLon, spot.lat, spot.lon)
    if (spot.cellId === cellFeature.properties.id && dist > 150) {
      // Snapped hotspot in the same 250m cell
      dist = 50
    }

    if (dist < minDistance) {
      minDistance = dist
      nearest = spot
    }
  }

  if (nearest && minDistance <= maxRadiusM) {
    return {
      id: nearest.id,
      name: nearest.name,
      distanceMeters: minDistance,
      articleDate: nearest.articleDate || null,
      sourceUrl: nearest.sourceUrl || null,
      evidence: nearest.evidence,
      precision: nearest.precision,
    }
  }

  return null
}

/**
 * Generates full explainability payload for a single grid cell.
 */
export function explainCellRisk(cellId: string, cityId: string = 'amritsar'): CellExplanation {
  if (!isCitySupported(cityId)) {
    throw new Error(`Unsupported city '${cityId}'.`)
  }

  const config = getCityConfig(cityId)
  const susceptibility = getCitySusceptibility(cityId)
  const hotspots = getCityHotspots(cityId)

  let feature = susceptibility.features.find((f) => f.properties.id === cellId)
  if (!feature) {
    try {
      const campus = getCityCampusSusceptibility(cityId)
      feature = campus.features.find((f) => f.properties.id === cellId)
    } catch {
      // campus not available
    }
  }
  if (!feature) {
    throw new Error(`Cell '${cellId}' not found in susceptibility grid for city '${cityId}'.`)
  }

  const sValue = feature.properties.s
  const sB = sBand(sValue)

  // Compute factor contributions
  const factorContributions: FactorContribution[] = []
  const weights = config.weights

  for (const [factorKey, meta] of Object.entries(FACTOR_METADATA)) {
    const rawVal = (feature.properties as unknown as Record<string, unknown>)[meta.key]
    const featureVal = typeof rawVal === 'number' && Number.isFinite(rawVal) ? rawVal : 0

    const weight = weights[meta.weightKey] ?? 0
    const contribution = Math.round(featureVal * weight * 10000) / 10000

    factorContributions.push({
      factor: factorKey,
      label: meta.label,
      featureValue: featureVal,
      appliedWeight: weight,
      contribution,
    })
  }

  const terrainOverride = {
    applied: config.terrainOverride?.applied ?? false,
    reason: config.terrainOverride?.reason ?? 'Normal terrain variance',
    note: config.terrainOverride?.applied
      ? 'Terrain override active: elevation flatness weights adjusted due to minimal topographic variance.'
      : undefined,
  }

  const nearbyHotspot = findNearbyHotspot(feature, hotspots, 500)

  let buildingExposure: CellBuildingExposure | undefined
  try {
    const indexPath = path.join(
      process.cwd(),
      'public',
      'data',
      'cities',
      cityId,
      'buildings',
      'cell_index.json'
    )
    if (fs.existsSync(indexPath)) {
      const indexJson = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
      const cellEntry = indexJson.cells?.[cellId]
      if (cellEntry) {
        buildingExposure = {
          buildingCount: cellEntry.buildingCount,
          totalFootprintAreaM2: cellEntry.totalFootprintAreaM2,
          meanFootprintAreaM2: cellEntry.meanFootprintAreaM2,
          highConfidenceCount: cellEntry.highConfidenceCount,
          exposureCategory: cellEntry.exposureCategory,
          scientificCaveat:
            'Macro-catchment exposure only; does NOT predict indoor water depth or structural safety.',
        }
      }
    }
  } catch {
    // Non-fatal if index file is absent or during build
  }

  const provenance = {
    elevationSource: 'Copernicus DEM GLO-30 (30m)',
    landCoverSource: 'ESA WorldCover 2021 (10m)',
    roadSource: 'OpenStreetMap Vectors',
    evidenceClass: 'remotely_sensed',
    methodology: 'Multi-scale Topographic Position Index (TPI) & raster sampling',
  }

  const valueMeta: Record<string, ValueMeta> = {
    susceptibility: ValueMetaPresets.susceptibility(provenance.elevationSource),
    ...(nearbyHotspot && {
      nearbyHotspot: ValueMetaPresets.observation(false, true),
    }),
    ...(buildingExposure && {
      buildingExposure: ValueMetaPresets.buildingExposure(),
    }),
  }

  return {
    cellId,
    cityId,
    sValue,
    sBand: sB,
    nearestRoad: feature.properties.nearestRoad,
    factorContributions,
    terrainOverride,
    nearbyHotspot,
    buildingExposure,
    provenance,
    valueMeta,
    limitations: [...EXPLANATION_LIMITATIONS],
  }
}
