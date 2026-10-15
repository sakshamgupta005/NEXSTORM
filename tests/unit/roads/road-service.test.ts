/**
 * tests/unit/roads/road-service.test.ts
 * Unit tests for road risk assessment, multi-cell spatial intersection weighting,
 * observation linking, and candidate route exposure comparison.
 */

import { describe, expect, it } from 'vitest'
import { roadRiskService } from '@/lib/roads/service'
import {
  roadRiskQuerySchema,
  routeCompareRequestSchema,
} from '@/lib/validations/roads'
import type { CandidateRouteInput } from '@/lib/roads/types'

describe('Road Risk Validation Schemas', () => {
  it('validates correct road query parameters', () => {
    const validQuery = {
      cityId: 'amritsar',
      bbox: [74.82, 31.60, 74.90, 31.66] as [number, number, number, number],
      highway: 'primary,secondary',
      riskClass: 'high',
      hasUnderpass: 'true',
      limit: '50',
      offset: '0',
    }

    const res = roadRiskQuerySchema.safeParse(validQuery)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.highway).toEqual(['primary', 'secondary'])
      expect(res.data.hasUnderpass).toBe(true)
      expect(res.data.limit).toBe(50)
    }
  })

  it('rejects invalid bounding box format or values', () => {
    const invalidQuery = {
      cityId: 'amritsar',
      bbox: '74.82,31.60', // only 2 coordinates
    }

    const res = roadRiskQuerySchema.safeParse(invalidQuery)
    expect(res.success).toBe(false)
  })

  it('validates candidate route compare payload', () => {
    const validPayload = {
      cityId: 'amritsar',
      routes: [
        {
          routeId: 'route-test-1',
          name: 'Mall Road Arterial',
          coordinates: [
            [74.865, 31.632],
            [74.870, 31.635],
          ],
        },
      ],
    }

    const res = routeCompareRequestSchema.safeParse(validPayload)
    expect(res.success).toBe(true)
  })

  it('rejects candidate route with fewer than 2 coordinates', () => {
    const invalidPayload = {
      cityId: 'amritsar',
      routes: [
        {
          routeId: 'route-single-point',
          name: 'Invalid Route',
          coordinates: [[74.865, 31.632]],
        },
      ],
    }

    const res = routeCompareRequestSchema.safeParse(invalidPayload)
    expect(res.success).toBe(false)
  })
})

describe('RoadRiskService - Amritsar Road Network', () => {
  it('loads real Amritsar road dataset and returns accurate counts', async () => {
    const topology = await roadRiskService.getNetworkTopology()
    expect(topology.totalSegments).toBeGreaterThan(14000)
    expect(topology.totalNodes).toBeGreaterThan(20000)
    expect(topology.taggedUnderpasses).toBeGreaterThan(0)
  })

  it('queries road segments with bounding box filter', async () => {
    // City center bounding box
    const result = await roadRiskService.queryRoads({
      cityId: 'amritsar',
      bbox: [74.86, 31.62, 74.88, 31.64],
      limit: 10,
    })

    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items.length).toBeLessThanOrEqual(10)
    expect(result.total).toBeGreaterThan(0)

    const first = result.items[0]
    expect(first.segmentId).toBeDefined()
    expect(first.geometry.type).toBe('LineString')
    expect(first.lengthM).toBeGreaterThan(0)
    expect(first.intersectingCells.length).toBeGreaterThanOrEqual(1)
    expect(['low', 'moderate', 'high']).toContain(first.modeledRiskClass)
    expect(first.weightedCellSusceptibility).toBeGreaterThanOrEqual(0)
    expect(first.weightedCellSusceptibility).toBeLessThanOrEqual(1)
  })

  it('retrieves tagged underpass segments with heightened risk consideration', async () => {
    const result = await roadRiskService.queryRoads({
      cityId: 'amritsar',
      hasUnderpass: true,
      limit: 10,
    })

    expect(result.items.length).toBeGreaterThan(0)
    for (const seg of result.items) {
      expect(seg.isUnderpass).toBe(true)
      // Dynamic risk for underpasses must be elevated or tagged
      expect(['moderate', 'high']).toContain(seg.dynamicRiskClass)
    }
  })

  it('filters by highway classification', async () => {
    const result = await roadRiskService.queryRoads({
      cityId: 'amritsar',
      highway: ['primary', 'trunk'],
      limit: 20,
    })

    expect(result.items.length).toBeGreaterThan(0)
    for (const seg of result.items) {
      expect(['primary', 'trunk']).toContain(seg.highway)
    }
  })

  it('correctly handles multi-cell intersection weighting for individual segments', async () => {
    const result = await roadRiskService.queryRoads({
      cityId: 'amritsar',
      limit: 50,
    })

    // Find a segment that intersects multiple cells
    const multiCellSegment = result.items.find((s) => s.intersectingCells.length > 1)
    expect(multiCellSegment).toBeDefined()

    if (multiCellSegment) {
      const totalFraction = multiCellSegment.intersectingCells.reduce(
        (sum, c) => sum + c.fraction,
        0
      )
      // Cell fractions plus unmatched coverage fraction sum to 1.0
      expect(totalFraction + multiCellSegment.unmatchedFraction).toBeCloseTo(1.0, 1)

      // Max susceptibility must be >= weighted susceptibility
      expect(multiCellSegment.maxCellSusceptibility).toBeGreaterThanOrEqual(
        multiCellSegment.weightedCellSusceptibility - 0.001
      )
    }
  })
})

describe('RoadRiskService - Candidate Route Exposure Comparison', () => {
  it('evaluates and ranks candidate routes by flood safety', async () => {
    const testRoutes: CandidateRouteInput[] = [
      {
        routeId: 'safe-corridor',
        name: 'Arterial GT Road Bypass',
        coordinates: [
          [74.838, 31.632],
          [74.851, 31.634],
          [74.868, 31.635],
        ],
      },
      {
        routeId: 'underpass-chokepoint',
        name: 'Railway Underpass Chokepoint Route',
        coordinates: [
          [74.862, 31.621],
          [74.869, 31.627],
          [74.872, 31.631],
        ],
      },
    ]

    const comparison = await roadRiskService.evaluateCandidateRoutes(testRoutes)

    expect(comparison.rankedRoutes.length).toBe(2)
    expect(comparison.comparisonSummary.totalRoutesCompared).toBe(2)
    expect(comparison.safestRouteId).toBeDefined()

    for (const route of comparison.rankedRoutes) {
      expect(route.totalDistanceKm).toBeGreaterThan(0)
      expect(route.compositePenaltyScore).toBeGreaterThanOrEqual(0)
      expect(route.compositePenaltyScore).toBeLessThanOrEqual(100)
      expect(['recommended', 'caution', 'avoid']).toContain(route.recommendation)
      expect(route.exposureByClass.high).toBeGreaterThanOrEqual(0)
      expect(route.exposureByClass.moderate).toBeGreaterThanOrEqual(0)
      expect(route.exposureByClass.low).toBeGreaterThanOrEqual(0)

      const totalExposure =
        route.exposureByClass.high +
        route.exposureByClass.moderate +
        route.exposureByClass.low
      expect(totalExposure).toBeCloseTo(1.0, 1)
    }

    // Verify ordering: first ranked route must have <= penalty score than second
    expect(comparison.rankedRoutes[0].compositePenaltyScore).toBeLessThanOrEqual(
      comparison.rankedRoutes[1].compositePenaltyScore
    )
  })
})
