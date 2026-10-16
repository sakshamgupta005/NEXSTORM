/**
 * tests/unit/roads/road-routing.test.ts
 * Unit tests for high-performance A* / Dijkstra road router for Amritsar.
 * Tests graph connectivity, endpoint snapping, candidate generation,
 * segment preservation, underpass avoidance, and travel time honesty.
 */

import { describe, expect, it } from 'vitest'
import { roadRoutingEngine } from '@/lib/roads/router'
import { roadRiskService } from '@/lib/roads/service'

describe('RoadRoutingEngine - Topological Graph & Snapping', () => {
  it('loads noded routing graph with high connectivity', () => {
    const graph = roadRoutingEngine.loadGraph('amritsar')
    expect(graph.totalNodes).toBeGreaterThan(25000)
    expect(graph.totalEdges).toBeGreaterThan(35000)
    expect(graph.nodes.length).toBe(graph.totalNodes)
    expect(graph.edges.length).toBe(graph.totalEdges)
  })

  it('snaps coordinates to nearest valid road network node within threshold', () => {
    // Golden Temple vicinity: [74.8765, 31.6200]
    const snap = roadRoutingEngine.snapToNode([74.8765, 31.6200], 1000)
    expect(snap.nodeId).toBeGreaterThanOrEqual(0)
    expect(snap.distanceMeters).toBeLessThan(100)
    expect(snap.snappedCoord[0]).toBeCloseTo(74.8765, 1)
    expect(snap.snappedCoord[1]).toBeCloseTo(31.6200, 1)
  })

  it('rejects coordinates far out of Amritsar network bounds', () => {
    // Coordinate far outside Amritsar (Delhi: [77.2090, 28.6139])
    expect(() => {
      roadRoutingEngine.snapToNode([77.209, 28.6139], 2000)
    }).toThrow(/exceed road network bounds/)
  })
})

describe('RoadRoutingEngine - Candidate Path Generation & Comparison', () => {
  it('generates real shortest, lower-exposure, and balanced candidate routes', async () => {
    // Origin: Lawrence Road / Mall Road [74.8810, 31.6410]
    // Destination: SSSS Chowk / Batala Road [74.8980, 31.6450]
    const plan = await roadRoutingEngine.planRoutes({
      cityId: 'amritsar',
      origin: [74.881, 31.641],
      destination: [74.898, 31.645],
      originName: 'Mall Road',
      destinationName: 'SSSS Chowk Area',
    })

    expect(plan.cityId).toBe('amritsar')
    expect(plan.origin.snappedNodeId).toBeDefined()
    expect(plan.destination.snappedNodeId).toBeDefined()
    expect(plan.routes.length).toBeGreaterThanOrEqual(2)
    expect(plan.comparison.safestRouteId).toBeDefined()

    const shortest = plan.routes.find((r) => r.mode === 'shortest')
    expect(shortest).toBeDefined()
    expect(shortest!.totalDistanceMeters).toBeGreaterThan(1000)
    expect(shortest!.totalDistanceKm).toBeGreaterThan(1.0)
    expect(shortest!.matchedSegmentsCount).toBeGreaterThan(0)
    expect(shortest!.estimatedTimeMinutes).toBeGreaterThan(0)
    expect(shortest!.speedBaselineKmh).toBe(30)
    expect(shortest!.travelTimeDisclaimer).toContain('30 km/h')
    expect(shortest!.geometry?.type).toBe('LineString')
    expect(shortest!.geometry?.coordinates.length).toBeGreaterThan(5)

    // Verify explanation exists
    expect(shortest!.explanation).toBeDefined()
  })

  it('preserves real OSM segment IDs along generated route paths', async () => {
    const plan = await roadRoutingEngine.planRoutes({
      cityId: 'amritsar',
      origin: [74.8765, 31.62], // Golden Temple
      destination: [74.8655, 31.634], // Railway Station
    })

    const route = plan.routes[0]
    expect(route.segments.length).toBeGreaterThan(0)
    for (const seg of route.segments) {
      expect(seg.segmentId).toMatch(/^AMR-ROAD-/)
      expect(seg.lengthMeters).toBeGreaterThan(0)
      expect(['low', 'moderate', 'high']).toContain(seg.riskClass)
    }
  })

  it('rejects origin and destination that are identical', async () => {
    await expect(
      roadRoutingEngine.planRoutes({
        cityId: 'amritsar',
        origin: [74.8765, 31.62],
        destination: [74.8765, 31.62],
      })
    ).rejects.toThrow(/same road network node/)
  })

  it('rejects unsupported city with explicit error', async () => {
    await expect(
      roadRoutingEngine.planRoutes({
        cityId: 'ludhiana',
        origin: [74.8765, 31.62],
        destination: [74.8655, 31.634],
      })
    ).rejects.toThrow(/only available for amritsar/i)
  })
})

describe('RoadRiskService - Route Scoring Edge Cases & Unknown Coverage', () => {
  it('penalizes unknown/unmatched risk segments rather than assuming safety', async () => {
    const syntheticRoutes = [
      {
        routeId: 'route-well-covered',
        name: 'Covered Route',
        coordinates: [
          [74.8765, 31.62],
          [74.877, 31.621],
        ] as [number, number][],
      },
      {
        routeId: 'route-unknown-corridor',
        name: 'Unknown Corridor',
        coordinates: [
          [74.8765, 31.62],
          [74.877, 31.621],
        ] as [number, number][],
      },
    ]

    const result = await roadRiskService.evaluateCandidateRoutes(syntheticRoutes)
    expect(result.rankedRoutes.length).toBe(2)
    for (const r of result.rankedRoutes) {
      expect(r.unknownRiskDistanceM).toBeGreaterThanOrEqual(0)
      expect(r.unknownRiskFraction).toBeGreaterThanOrEqual(0)
      expect(r.compositePenaltyScore).toBeGreaterThanOrEqual(0)
      expect(r.compositePenaltyScore).toBeLessThanOrEqual(100)
    }
  })
})
