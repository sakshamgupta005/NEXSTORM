/**
 * tests/unit/buildings/building-service.test.ts
 * Unit tests for building footprint exposure assessment, metric area calculation,
 * multi-cell intersection weighting, and exposure categorization.
 */

import { describe, expect, it } from 'vitest'
import { buildingExposureService } from '@/lib/buildings/service'
import { buildingQuerySchema } from '@/lib/validations/buildings'

describe('Building Validation Schema', () => {
  it('validates valid building query parameters', () => {
    const valid = {
      cityId: 'amritsar',
      bbox: [74.85, 31.62, 74.88, 31.65] as [number, number, number, number],
      exposureCategory: 'high_catchment',
      minAreaM2: '50',
      limit: '50',
    }

    const res = buildingQuerySchema.safeParse(valid)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.minAreaM2).toBe(50)
      expect(res.data.limit).toBe(50)
    }
  })

  it('rejects invalid cellId format', () => {
    const invalid = {
      cityId: 'amritsar',
      cellId: 'A-0001; DROP TABLE buildings;',
    }

    const res = buildingQuerySchema.safeParse(invalid)
    expect(res.success).toBe(false)
  })
})

describe('BuildingExposureService', () => {
  it('loads cell index with aggregated building summaries', () => {
    const index = buildingExposureService.loadCellIndex('amritsar')
    expect(index.size).toBeGreaterThan(1500)

    // Inspect first cell entry
    const first = Array.from(index.values())[0]
    expect(first.cellId).toBeDefined()
    expect(first.buildingCount).toBeGreaterThan(0)
    expect(first.totalFootprintAreaM2).toBeGreaterThan(0)
    expect(first.meanFootprintAreaM2).toBeGreaterThan(0)
    expect(['high_catchment', 'moderate_catchment', 'low_catchment', 'minimal']).toContain(
      first.exposureCategory
    )
  })

  it('calculates planar metric polygon area accurately', () => {
    // 20m x 25m rectangle in Amritsar coordinate space
    // Near latitude 31.63 N: 1 deg lat ~ 110540m, 1 deg lon ~ 94815m
    const dLat = 25.0 / 110540.0 // ~0.000226 deg
    const dLng = 20.0 / (111320.0 * Math.cos((31.63 * Math.PI) / 180.0)) // ~0.000211 deg

    const ring = [
      [74.86, 31.63],
      [74.86 + dLng, 31.63],
      [74.86 + dLng, 31.63 + dLat],
      [74.86, 31.63 + dLat],
      [74.86, 31.63],
    ]

    const area = buildingExposureService.calculatePolygonAreaM2(ring)
    // Should be approximately 500 m^2 (+/- 2%)
    expect(area).toBeGreaterThan(485)
    expect(area).toBeLessThan(515)
  })

  it('evaluates multi-cell footprint exposure correctly without relying on centroid alone', () => {
    // Building straddling boundary between Cell A (s=0.75, 40%) and Cell B (s=0.35, 60%)
    const ring = [
      [74.85, 31.63],
      [74.852, 31.63],
      [74.852, 31.632],
      [74.85, 31.632],
      [74.85, 31.63],
    ]

    const evaluated = buildingExposureService.evaluateFootprintExposure({
      buildingId: 'GOB-SYNTHETIC-01',
      coordinates: ring,
      confidence: 0.88,
      cellIntersections: [
        { cellId: 'A-WEST', susceptibility: 0.75, intersectionFraction: 0.4 },
        { cellId: 'A-EAST', susceptibility: 0.35, intersectionFraction: 0.6 },
      ],
    })

    expect(evaluated.buildingId).toBe('GOB-SYNTHETIC-01')
    expect(evaluated.areaM2).toBeGreaterThan(0)
    expect(evaluated.intersectingCells.length).toBe(2)

    // Verify proportions sum to 1.0
    const totalFraction = evaluated.intersectingCells.reduce((sum, c) => sum + c.fraction, 0)
    expect(totalFraction).toBeCloseTo(1.0, 2)
    expect(evaluated.unmatchedFraction).toBe(0)

    // Weighted susceptibility = (0.75 * 0.4) + (0.35 * 0.6) = 0.30 + 0.21 = 0.51
    expect(evaluated.weightedSusceptibility).toBeCloseTo(0.51, 2)

    // Conservative maximum susceptibility = 0.75
    expect(evaluated.maxCellSusceptibility).toBe(0.75)
    expect(evaluated.maxCellSusceptibility).toBeGreaterThan(evaluated.weightedSusceptibility)

    // Category should be high_catchment because maxCellSusceptibility >= 0.66
    expect(evaluated.exposureCategory).toBe('high_catchment')

    // Verify scientific caveat is present and disclaims structural damage
    expect(evaluated.scientificCaveat).toContain('Macro-catchment flood exposure only')
    expect(evaluated.scientificCaveat).toContain('Does not predict indoor water depth')
  })

  it('marks footprints outside grid extent as unmatched', () => {
    const ring = [
      [68.0, 15.0],
      [68.01, 15.0],
      [68.01, 15.01],
      [68.0, 15.01],
      [68.0, 15.0],
    ]

    const evaluated = buildingExposureService.evaluateFootprintExposure({
      buildingId: 'GOB-OOB-01',
      coordinates: ring,
      cellIntersections: [], // No grid cell intersection
    })

    expect(evaluated.exposureCategory).toBe('unmatched')
    expect(evaluated.unmatchedFraction).toBe(1.0)
    expect(evaluated.intersectingCells.length).toBe(0)
  })

  it('queries real indexed building footprints with viewport and area filters', () => {
    const result = buildingExposureService.queryBuildings({
      cityId: 'amritsar',
      bbox: [74.86, 31.62, 74.88, 31.64],
      minAreaM2: 20,
      limit: 10,
    })

    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items.length).toBeLessThanOrEqual(10)
    expect(result.total).toBeGreaterThan(0)

    const first = result.items[0]
    expect(first.buildingId.startsWith('GOB-')).toBe(true)
    expect(first.areaM2).toBeGreaterThanOrEqual(20)
    expect(first.geometry.type).toBe('Polygon')
    expect(first.source).toBe('Google Open Buildings V3')
    expect(first.license).toBe('CC-BY-4.0')
  })
})
