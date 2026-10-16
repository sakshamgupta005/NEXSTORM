/**
 * src/lib/buildings/service.ts
 * Building Exposure Assessment Service for NEXSTORM.
 *
 * Evaluates building-level flood exposure across Amritsar by associating real
 * building footprints (from Google Open Buildings V3) with the 250m susceptibility grid.
 *
 * Scientific Guardrails:
 * 1. Area susceptibility = surrounding grid cell runoff accumulation propensity.
 * 2. Building exposure = spatial footprint overlap with grid cells (area-weighted & max).
 * 3. Building vulnerability = UNKNOWN / NOT INVENTED (no plinth, no structural damage claimed).
 */

import fs from 'node:fs'
import path from 'node:path'
import type {
  BuildingCellIntersection,
  BuildingExposureCategory,
  BuildingExposureRecord,
  BuildingQueryFilters,
  CellBuildingSummary,
} from './types'
import type { ProvenanceMetadata } from '../spatial/types'
import { imageEvidenceService } from '../images/service'
import { RiskFusionEngine, DEFAULT_FUSION_CONFIG, type FusedRiskResult } from '../images/fusion'

const SCIENTIFIC_CAVEAT =
  'Macro-catchment flood exposure only. Does not predict indoor water depth, structural damage, or plinth clearance.'

export class BuildingExposureService {
  private static instance: BuildingExposureService
  private cellIndexCaches = new Map<string, Map<string, CellBuildingSummary>>()
  private buildingsCaches = new Map<string, BuildingExposureRecord[]>()

  private constructor() {}

  public static getInstance(): BuildingExposureService {
    if (!BuildingExposureService.instance) {
      BuildingExposureService.instance = new BuildingExposureService()
    }
    return BuildingExposureService.instance
  }

  /**
   * Loads the aggregated cell index (`cell_index.json`) mapping cells to building summaries.
   */
  public loadCellIndex(cityId: string = 'amritsar'): Map<string, CellBuildingSummary> {
    const key = cityId.toLowerCase()
    const cached = this.cellIndexCaches.get(key)
    if (cached) {
      return cached
    }

    const indexPath = path.join(
      process.cwd(),
      'public',
      'data',
      'cities',
      key,
      'buildings',
      'cell_index.json'
    )

    const map = new Map<string, CellBuildingSummary>()

    if (fs.existsSync(indexPath)) {
      try {
        const raw = fs.readFileSync(indexPath, 'utf-8')
        const data = JSON.parse(raw)
        if (data.cells) {
          for (const [cellId, entry] of Object.entries(data.cells)) {
            const e = entry as Record<string, unknown>
            map.set(cellId, {
              cellId,
              buildingCount: Number(e.buildingCount || 0),
              totalFootprintAreaM2: Number(e.totalFootprintAreaM2 || 0),
              meanFootprintAreaM2: Number(e.meanFootprintAreaM2 || 0),
              highConfidenceCount: Number(e.highConfidenceCount || 0),
              meanConfidence: Number(e.meanConfidence || 0),
              exposureCategory: (e.exposureCategory as BuildingExposureCategory) || 'low_catchment',
            })
          }
        }
      } catch (err) {
        console.error('[BUILDING_SERVICE] Failed to parse cell_index.json:', err)
      }
    }

    this.cellIndexCaches.set(key, map)
    return map
  }

  /**
   * Retrieves aggregated building exposure statistics for a single grid cell.
   */
  public getCellBuildingSummary(
    cellId: string,
    cityId: string = 'amritsar'
  ): CellBuildingSummary | null {
    const index = this.loadCellIndex(cityId)
    return index.get(cellId) || null
  }

  /**
   * Loads and caches building footprints from hotspot clusters and campus GeoJSON files.
   */
  public loadIndexedBuildings(cityId: string = 'amritsar'): BuildingExposureRecord[] {
    const key = cityId.toLowerCase()
    const cached = this.buildingsCaches.get(key)
    if (cached) {
      return cached
    }

    const records: BuildingExposureRecord[] = []
    const provenance: ProvenanceMetadata = {
      sourceName: 'Google Open Buildings V3 (S2 Cell 391)',
      sourceUrl: 'https://sites.research.google/open-buildings/',
      retrievalDate: '2026-10-15T11:50:29Z',
      license: 'CC-BY-4.0',
      evidenceKind: 'modeled',
    }

    // 1. Load Hotspot buildings GeoJSON
    const hotspotPath = path.join(
      process.cwd(),
      'public',
      'data',
      'cities',
      key,
      'buildings',
      'hotspot_buildings.geojson'
    )

    if (fs.existsSync(hotspotPath)) {
      try {
        const raw = fs.readFileSync(hotspotPath, 'utf-8')
        const geojson = JSON.parse(raw)
        if (geojson.features) {
          for (const f of geojson.features) {
            const p = f.properties || {}
            const coords = f.geometry?.coordinates
            if (!coords) continue

            // Compute approximate centroid
            const centroid = this.computePolygonCentroid(coords)
            const cellId = String(p.cellId || 'UNMATCHED')
            const s = Number(p.susceptibilityScore || 0)
            const areaM2 = Number(p.area_m2 || 0)

            let exposureCategory: BuildingExposureCategory = 'low_catchment'
            if (cellId === 'UNMATCHED') {
              exposureCategory = 'unmatched'
            } else if (s >= 0.66) {
              exposureCategory = 'high_catchment'
            } else if (s >= 0.33) {
              exposureCategory = 'moderate_catchment'
            }

            records.push({
              buildingId: String(p.buildingId || `GOB-${records.length}`),
              source: 'Google Open Buildings V3',
              license: 'CC-BY-4.0',
              confidence: Number(p.confidence || 0.75),
              areaM2,
              centroid,
              geometry: f.geometry,
              primaryCellId: cellId,
              intersectingCells: [
                {
                  cellId,
                  susceptibility: s,
                  intersectionAreaM2: areaM2,
                  fraction: cellId === 'UNMATCHED' ? 0.0 : 1.0,
                },
              ],
              weightedSusceptibility: s,
              maxCellSusceptibility: s,
              unmatchedFraction: cellId === 'UNMATCHED' ? 1.0 : 0.0,
              exposureCategory,
              provenance,
              scientificCaveat: SCIENTIFIC_CAVEAT,
            })
          }
        }
      } catch (err) {
        console.error('[BUILDING_SERVICE] Failed to parse hotspot_buildings.geojson:', err)
      }
    }

    this.buildingsCaches.set(key, records)
    return records
  }

  /**
   * Computes planar geodesic metric area (m^2) for a WGS84 polygon.
   */
  public calculatePolygonAreaM2(coords: number[][]): number {
    if (!coords || coords.length < 3) return 0

    // Reference latitude in Amritsar (~31.63 deg N)
    const refLat = coords[0][1]
    const latRad = (refLat * Math.PI) / 180.0
    const mPerLng = 111320.0 * Math.cos(latRad)
    const mPerLat = 110540.0

    // Shoelace formula in projected metric coordinates
    let area = 0
    for (let i = 0; i < coords.length - 1; i++) {
      const x1 = coords[i][0] * mPerLng
      const y1 = coords[i][1] * mPerLat
      const x2 = coords[i + 1][0] * mPerLng
      const y2 = coords[i + 1][1] * mPerLat
      area += x1 * y2 - x2 * y1
    }

    return Math.abs(area) / 2.0
  }

  /**
   * Helper to compute approximate centroid of polygon coordinates.
   */
  private computePolygonCentroid(coords: number[][][]): { lng: number; lat: number } {
    const ring = coords[0] || []
    if (ring.length === 0) return { lng: 0, lat: 0 }

    let sumLng = 0
    let sumLat = 0
    const count = ring.length - 1 || 1

    for (let i = 0; i < count; i++) {
      sumLng += ring[i][0]
      sumLat += ring[i][1]
    }

    return {
      lng: Math.round((sumLng / count) * 1000000) / 1000000,
      lat: Math.round((sumLat / count) * 1000000) / 1000000,
    }
  }

  /**
   * Evaluates exact multi-cell exposure metrics for a single building polygon.
   * Calculates metric area, per-cell area fractions, weighted susceptibility, and max susceptibility.
   */
  public evaluateFootprintExposure(params: {
    buildingId: string
    coordinates: number[][] // exterior ring in [lng, lat]
    confidence?: number
    cellIntersections: Array<{
      cellId: string
      susceptibility: number
      intersectionFraction: number // [0.0, 1.0]
    }>
  }): BuildingExposureRecord {
    const areaM2 = Math.round(this.calculatePolygonAreaM2(params.coordinates) * 100) / 100
    const centroid = this.computePolygonCentroid([params.coordinates])

    let sumFraction = 0
    let weightedSusceptibility = 0
    let maxCellSusceptibility = 0
    let primaryCellId = 'UNMATCHED'
    let maxCellFraction = -1

    const intersectingCells: BuildingCellIntersection[] = []

    for (const c of params.cellIntersections) {
      const frac = Math.max(0, Math.min(1.0, c.intersectionFraction))
      sumFraction += frac
      const interArea = Math.round(areaM2 * frac * 100) / 100

      intersectingCells.push({
        cellId: c.cellId,
        susceptibility: c.susceptibility,
        intersectionAreaM2: interArea,
        fraction: frac,
      })

      weightedSusceptibility += c.susceptibility * frac
      if (c.susceptibility > maxCellSusceptibility) {
        maxCellSusceptibility = c.susceptibility
      }

      if (frac > maxCellFraction) {
        maxCellFraction = frac
        primaryCellId = c.cellId
      }
    }

    const unmatchedFraction = Math.max(0, Math.round((1.0 - Math.min(1.0, sumFraction)) * 100) / 100)

    let exposureCategory: BuildingExposureCategory = 'low_catchment'
    if (unmatchedFraction >= 0.99 || intersectingCells.length === 0) {
      exposureCategory = 'unmatched'
    } else if (maxCellSusceptibility >= 0.66) {
      exposureCategory = 'high_catchment'
    } else if (maxCellSusceptibility >= 0.33) {
      exposureCategory = 'moderate_catchment'
    }

    const baseRiskScore = Math.min(100, Math.round(maxCellSusceptibility * 100))

    // Strictly localized spatial matching using centroid (<= 35m) to avoid cell-wide indiscriminate bleed
    const imageEvidence = imageEvidenceService.getBuildingImageSummary(params.buildingId, centroid, false)
    const activeImages = imageEvidence.filter((img) => !img.isHistorical)
    const hasActiveImageEvidence = activeImages.length > 0
    const imageConfirmedFlooding = activeImages.some((img) => img.floodedBuilding || img.waterDetected)

    // Fused risk calculation: R_final = clamp((1 - w*q)*R_base + (w*q)*R_visual, 0, 100)
    let bestFusion: FusedRiskResult = {
      rFinal: baseRiskScore,
      rBase: baseRiskScore,
      rVisual: 10,
      q: 0.0,
      w: DEFAULT_FUSION_CONFIG.maxVisualWeight,
      effectiveWeight: 0.0,
      fusionReason: 'No eligible visual evidence; verified base model score preserved.',
      isVisuallyElevated: false,
      activeImageCount: 0,
      historicalImageCount: imageEvidence.filter((img) => img.isHistorical).length,
    }

    if (activeImages.length > 0) {
      for (const img of activeImages) {
        const vScore = RiskFusionEngine.computeBuildingVisualScore(img)
        const q = RiskFusionEngine.evaluateBuildingReliability(img, img.distanceMeters ?? 0)
        const fused = RiskFusionEngine.fuseRisk({
          rBase: baseRiskScore,
          visualScore: vScore,
          reliability: q,
        })
        if (fused.rFinal > bestFusion.rFinal || (fused.q > bestFusion.q && bestFusion.q === 0)) {
          bestFusion = {
            ...fused,
            activeImageCount: activeImages.length,
            historicalImageCount: imageEvidence.filter((r) => r.isHistorical).length,
          }
        }
      }
    }

    let dynamicExposureCategory: BuildingExposureCategory = exposureCategory
    if (bestFusion.rFinal >= 66 || imageConfirmedFlooding) {
      dynamicExposureCategory = 'high_catchment'
    } else if (bestFusion.rFinal >= 33 && dynamicExposureCategory === 'low_catchment') {
      dynamicExposureCategory = 'moderate_catchment'
    }

    return {
      buildingId: params.buildingId,
      source: 'Google Open Buildings V3',
      license: 'CC-BY-4.0',
      confidence: params.confidence ?? 0.8,
      areaM2,
      centroid,
      geometry: {
        type: 'Polygon',
        coordinates: [params.coordinates],
      },
      primaryCellId,
      intersectingCells,
      weightedSusceptibility: Math.round(weightedSusceptibility * 1000) / 1000,
      maxCellSusceptibility: Math.round(maxCellSusceptibility * 1000) / 1000,
      unmatchedFraction,
      exposureCategory,
      hasActiveImageEvidence,
      imageConfirmedFlooding,
      dynamicExposureCategory,
      imageEvidence: imageEvidence.length > 0 ? imageEvidence : undefined,
      riskScore: bestFusion.rFinal,
      baseRiskScore: bestFusion.rBase,
      visualRiskScore: bestFusion.rVisual,
      visualReliability: bestFusion.q,
      visualWeight: bestFusion.effectiveWeight,
      fusionReason: bestFusion.fusionReason,
      provenance: {
        sourceName: 'Google Open Buildings V3 (S2 Cell 391)',
        sourceUrl: 'https://sites.research.google/open-buildings/',
        retrievalDate: '2026-10-15T11:50:29Z',
        license: 'CC-BY-4.0',
        evidenceKind: 'modeled',
      },
      scientificCaveat: SCIENTIFIC_CAVEAT,
    }
  }

  /**
   * Queries building exposure records with geographic viewport and classification filters.
   */
  public queryBuildings(filters: BuildingQueryFilters): {
    total: number
    count: number
    items: BuildingExposureRecord[]
  } {
    const cityId = filters.cityId || 'amritsar'
    const buildings = this.loadIndexedBuildings(cityId)

    let minLng = filters.minLng
    let minLat = filters.minLat
    let maxLng = filters.maxLng
    let maxLat = filters.maxLat

    if (filters.bbox && filters.bbox.length === 4) {
      ;[minLng, minLat, maxLng, maxLat] = filters.bbox
    }

    const hasBbox =
      minLng !== undefined &&
      minLat !== undefined &&
      maxLng !== undefined &&
      maxLat !== undefined

    const categoryFilter = filters.exposureCategory
      ? Array.isArray(filters.exposureCategory)
        ? filters.exposureCategory
        : [filters.exposureCategory]
      : null

    const matched: BuildingExposureRecord[] = []

    for (const b of buildings) {
      if (filters.cellId && b.primaryCellId !== filters.cellId) {
        continue
      }

      if (hasBbox) {
        if (
          b.centroid.lng < minLng! ||
          b.centroid.lng > maxLng! ||
          b.centroid.lat < minLat! ||
          b.centroid.lat > maxLat!
        ) {
          continue
        }
      }

      if (categoryFilter && !categoryFilter.includes(b.exposureCategory)) {
        continue
      }

      if (filters.minAreaM2 !== undefined && b.areaM2 < filters.minAreaM2) {
        continue
      }

      if (filters.maxAreaM2 !== undefined && b.areaM2 > filters.maxAreaM2) {
        continue
      }

      matched.push(b)
    }

    const offset = filters.offset || 0
    const limit = Math.min(filters.limit || 100, 500)
    const paginated = matched.slice(offset, offset + limit).map((b) => {
      const baseRiskScore = Math.min(100, Math.round(b.maxCellSusceptibility * 100))
      const imageEvidence = imageEvidenceService.getBuildingImageSummary(b.buildingId, b.centroid, false)
      const activeImages = imageEvidence.filter((img) => !img.isHistorical)
      const hasActiveImageEvidence = activeImages.length > 0
      const imageConfirmedFlooding = activeImages.some((img) => img.floodedBuilding || img.waterDetected)

      let bestFusion: FusedRiskResult = {
        rFinal: baseRiskScore,
        rBase: baseRiskScore,
        rVisual: 10,
        q: 0.0,
        w: DEFAULT_FUSION_CONFIG.maxVisualWeight,
        effectiveWeight: 0.0,
        fusionReason: 'No eligible visual evidence; verified base model score preserved.',
        isVisuallyElevated: false,
        activeImageCount: 0,
        historicalImageCount: imageEvidence.filter((img) => img.isHistorical).length,
      }

      if (activeImages.length > 0) {
        for (const img of activeImages) {
          const vScore = RiskFusionEngine.computeBuildingVisualScore(img)
          const q = RiskFusionEngine.evaluateBuildingReliability(img, img.distanceMeters ?? 0)
          const fused = RiskFusionEngine.fuseRisk({
            rBase: baseRiskScore,
            visualScore: vScore,
            reliability: q,
          })
          if (fused.rFinal > bestFusion.rFinal || (fused.q > bestFusion.q && bestFusion.q === 0)) {
            bestFusion = {
              ...fused,
              activeImageCount: activeImages.length,
              historicalImageCount: imageEvidence.filter((r) => r.isHistorical).length,
            }
          }
        }
      }

      let dynamicExposureCategory: BuildingExposureCategory = b.exposureCategory
      if (bestFusion.rFinal >= 66 || imageConfirmedFlooding) {
        dynamicExposureCategory = 'high_catchment'
      } else if (bestFusion.rFinal >= 33 && dynamicExposureCategory === 'low_catchment') {
        dynamicExposureCategory = 'moderate_catchment'
      }

      return {
        ...b,
        hasActiveImageEvidence,
        imageConfirmedFlooding,
        dynamicExposureCategory,
        imageEvidence: imageEvidence.length > 0 ? imageEvidence : undefined,
        riskScore: bestFusion.rFinal,
        baseRiskScore: bestFusion.rBase,
        visualRiskScore: bestFusion.rVisual,
        visualReliability: bestFusion.q,
        visualWeight: bestFusion.effectiveWeight,
        fusionReason: bestFusion.fusionReason,
      }
    })

    return {
      total: matched.length,
      count: paginated.length,
      items: paginated,
    }
  }
}

export const buildingExposureService = BuildingExposureService.getInstance()
