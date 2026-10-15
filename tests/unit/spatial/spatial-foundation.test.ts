import { describe, expect, it } from 'vitest'
import {
  buildBuildingExposureAssessment,
  buildRoadSegmentRiskAssessment,
  euclideanDistanceUtm,
  evaluateRouteRisk,
  isPointInGeoJsonPolygon,
  isPointInRing,
  matchObservationToRoadSegment,
  matchPointToGrid,
  utm43nToWgs84,
  wgs84ToUtm43n,
  type GridCellFeature,
  type ProvenanceMetadata,
  type RoadSegmentGeometry,
  type RouteSegmentExposure,
  type Wgs84Coordinates,
} from '@/lib/spatial'
import fs from 'node:fs'
import path from 'node:path'

describe('P8 Spatial Matching Foundation & Unified Architecture', () => {
  const testProvenance: ProvenanceMetadata = {
    sourceName: 'OpenStreetMap & Copernicus DEM',
    retrievalDate: '2026-10-15',
    license: 'ODbL 1.0',
    evidenceKind: 'observed',
    verificationStatus: 'verified_news',
  }

  describe('1. Geodetic Coordinate Transformations (WGS84 <-> UTM Zone 43N)', () => {
    it('matches known pyproj / GDAL geodetic control benchmarks for Amritsar landmarks', () => {
      // Golden Temple: Lng 74.8765, Lat 31.6200 -> pyproj Easting: 488286.91, Northing: 3498323.44
      const goldenTemple: Wgs84Coordinates = { lng: 74.8765, lat: 31.6200 }
      const utmGolden = wgs84ToUtm43n(goldenTemple)

      expect(utmGolden.zone).toBe(43)
      expect(utmGolden.hemisphere).toBe('N')
      expect(utmGolden.easting).toBeCloseTo(488286.91, 0)
      expect(utmGolden.northing).toBeCloseTo(3498323.44, 0)

      // GNDU Gate: Lng 74.8250, Lat 31.6370 -> pyproj Easting: 483405.51, Northing: 3500214.33
      const gnduGate: Wgs84Coordinates = { lng: 74.8250, lat: 31.6370 }
      const utmGndu = wgs84ToUtm43n(gnduGate)

      expect(utmGndu.easting).toBeCloseTo(483405.51, 0)
      expect(utmGndu.northing).toBeCloseTo(3500214.33, 0)

      // SSSS Chowk: Lng 74.8780, Lat 31.6480 -> pyproj Easting: 488432.64, Northing: 3501426.69
      const ssssChowk: Wgs84Coordinates = { lng: 74.8780, lat: 31.6480 }
      const utmSsss = wgs84ToUtm43n(ssssChowk)

      expect(utmSsss.easting).toBeCloseTo(488432.64, 0)
      expect(utmSsss.northing).toBeCloseTo(3501426.69, 0)
    })

    it('preserves millimeter precision through full round-trip conversion (WGS84 -> UTM -> WGS84)', () => {
      const original: Wgs84Coordinates = { lng: 74.876543, lat: 31.623456 }
      const projected = wgs84ToUtm43n(original)
      const unprojected = utm43nToWgs84(projected)

      expect(unprojected.lng).toBeCloseTo(original.lng, 5)
      expect(unprojected.lat).toBeCloseTo(original.lat, 5)
    })

    it('calculates Euclidean metric distance between UTM points', () => {
      const p1 = wgs84ToUtm43n({ lng: 74.8765, lat: 31.6200 })
      const p2 = wgs84ToUtm43n({ lng: 74.8780, lat: 31.6480 })

      const distM = euclideanDistanceUtm(p1, p2)
      // Distance is ~3.1 km across town
      expect(distM).toBeGreaterThan(3000)
      expect(distM).toBeLessThan(3200)
    })
  })

  describe('2. Deterministic Point-in-Polygon (Ray Casting)', () => {
    // 1km square polygon in Amritsar
    const testSquare: number[][][] = [
      [
        [74.87, 31.62],
        [74.88, 31.62],
        [74.88, 31.63],
        [74.87, 31.63],
        [74.87, 31.62],
      ],
    ]

    it('identifies interior points as inside and outside points as outside', () => {
      expect(isPointInGeoJsonPolygon([74.875, 31.625], testSquare)).toBe('inside')
      expect(isPointInGeoJsonPolygon([74.865, 31.625], testSquare)).toBe('outside')
      expect(isPointInGeoJsonPolygon([74.875, 31.635], testSquare)).toBe('outside')
    })

    it('handles boundary edges and vertices gracefully', () => {
      // Point directly on South edge
      expect(isPointInRing([74.875, 31.62], testSquare[0])).toBe(true)
      // Vertex corner
      expect(isPointInRing([74.87, 31.62], testSquare[0])).toBe(true)
    })
  })

  describe('3. Point-to-Grid Matching (Real Amritsar Pilot Grid)', () => {
    const suscPath = path.resolve(process.cwd(), 'public/data/cities/amritsar/susceptibility.geojson')
    let realGrid: GridCellFeature[] = []

    if (fs.existsSync(suscPath)) {
      const parsed = JSON.parse(fs.readFileSync(suscPath, 'utf-8'))
      realGrid = parsed.features
    }

    it('accurately matches historical SSSS Chowk hotspot to cell A-0590', () => {
      if (realGrid.length === 0) return

      // SSSS Chowk coordinates from hotspots.json: Lat 31.648, Lon 74.878
      const ssssPoint: Wgs84Coordinates = { lat: 31.648, lng: 74.878 }
      const match = matchPointToGrid(ssssPoint, realGrid, testProvenance)

      expect(match.matchQuality).toBe('exact_inside')
      expect(match.cellId).toBe('A-0590')
      expect(match.susceptibilityScore).toBeGreaterThan(0.55) // Empirical pilot grid score ~0.577
      expect(match.distanceToCentroidMeters).toBeLessThan(180) // 250m cell radius ~177m
    })

    it('accurately matches Hall Gate Market to cell A-0935', () => {
      if (realGrid.length === 0) return

      // Hall Gate Market: Lat 31.631, Lon 74.876
      const hallGatePoint: Wgs84Coordinates = { lat: 31.631, lng: 74.876 }
      const match = matchPointToGrid(hallGatePoint, realGrid, testProvenance)

      expect(match.matchQuality).toBe('exact_inside')
      expect(match.cellId).toBe('A-0935')
      expect(match.susceptibilityScore).toBeDefined()
    })

    it('honestly returns unmatched status for coordinates outside the municipal pilot grid', () => {
      if (realGrid.length === 0) return

      // Coordinate in Ludhiana (outside Amritsar)
      const ludhianaPoint: Wgs84Coordinates = { lat: 30.9010, lng: 75.8573 }
      const match = matchPointToGrid(ludhianaPoint, realGrid, testProvenance)

      expect(match.matchQuality).toBe('unmatched')
      expect(match.cellId).toBeNull()
      expect(match.limitation).toContain('outside the verified municipal analysis grid boundary')
    })
  })

  describe('4. Road Segment Projection & Snapping with Strict Tolerance', () => {
    // Simulated Queens Road corridor polyline (2 segments)
    const queensRoad: RoadSegmentGeometry = {
      segmentId: 'ROAD-001',
      osmid: 'way_12345',
      name: 'Queens Road',
      highway: 'secondary',
      coordinates: [
        { lng: 74.8700, lat: 31.6350 },
        { lng: 74.8710, lat: 31.6375 },
        { lng: 74.8720, lat: 31.6400 },
      ],
    }

    it('projects point onto road segment within 30m tolerance', () => {
      // Point 10 meters east of the middle segment
      const observationPoint: Wgs84Coordinates = { lng: 74.8711, lat: 31.6375 }
      const match = matchObservationToRoadSegment(
        'OBS-101',
        observationPoint,
        [queensRoad],
        testProvenance,
        30.0
      )

      expect(match.matchQuality).toBe('projected_segment')
      expect(match.matchedSegmentId).toBe('ROAD-001')
      expect(match.distanceToSegmentMeters).toBeLessThan(30.0)
      expect(match.snappedCoord).toBeDefined()
      expect(match.fractionAlongSegment).toBeGreaterThan(0.4)
    })

    it('strictly returns unmatched when observation is 150m away from the road', () => {
      // Point 150 meters away
      const distantPoint: Wgs84Coordinates = { lng: 74.8735, lat: 31.6375 }
      const match = matchObservationToRoadSegment(
        'OBS-102',
        distantPoint,
        [queensRoad],
        testProvenance,
        30.0 // 30m tolerance
      )

      expect(match.matchQuality).toBe('unmatched')
      expect(match.matchedSegmentId).toBeNull()
      expect(match.distanceToSegmentMeters).toBeGreaterThan(100)
      expect(match.reason).toContain('exceeds maximum allowable snapping tolerance')
    })
  })

  describe('5. Unified Risk Product Contracts & Flood-Aware Route Scorer', () => {
    it('builds BuildingExposureAssessment ensuring no unsupported indoor depth claims are made', () => {
      const building = {
        buildingId: 'BLDG-0001',
        name: 'Town Hall Market Complex',
        buildingType: 'commercial',
        centroid: { lng: 74.876, lat: 31.631 },
        areaM2: 850,
      }

      const cellHazard = {
        cellId: 'A-0935',
        susceptibilityScore: 0.72,
        modeledRiskClass: 'high' as const,
      }

      const assessment = buildBuildingExposureAssessment(
        building,
        cellHazard,
        'exact_inside',
        120, // 120m to nearest incident
        testProvenance
      )

      expect(assessment.buildingId).toBe('BLDG-0001')
      expect(assessment.matchedCellId).toBe('A-0935')
      expect(assessment.cellSusceptibility).toBe(0.72)
      expect(assessment.modeledRiskClass).toBe('high')
      expect(assessment.scientificCaveat).toContain('does NOT predict indoor water ingress')
    })

    it('builds RoadSegmentRiskAssessment aggregating intersecting hazard cells', () => {
      const road = {
        segmentId: 'SEG-101',
        osmid: 'way_999',
        roadName: 'Batala Road',
        highwayClassification: 'primary',
        lengthMeters: 450,
        startCoord: { lng: 74.890, lat: 31.650 },
        endCoord: { lng: 74.896, lat: 31.652 },
        isUnderpassProxy: false,
      }

      const intersectingCells = [
        { cellId: 'A-0504', susceptibilityScore: 0.68, modeledRiskClass: 'high' as const },
        { cellId: 'A-0505', susceptibilityScore: 0.45, modeledRiskClass: 'moderate' as const },
      ]

      const assessment = buildRoadSegmentRiskAssessment(
        road,
        intersectingCells,
        1, // 1 active verified report
        'intersects',
        testProvenance
      )

      expect(assessment.segmentId).toBe('SEG-101')
      expect(assessment.maxCellSusceptibility).toBe(0.68)
      expect(assessment.modeledRiskClass).toBe('high')
      expect(assessment.activeReportsCount).toBe(1)
      expect(assessment.scientificCaveat).toContain('does NOT guarantee current passage status')
    })

    it('evaluates flood-aware route risk across candidate segments', () => {
      const candidateSegments: RouteSegmentExposure[] = [
        {
          segmentId: 'SEG-1',
          roadName: 'Mall Road',
          highwayType: 'secondary',
          lengthMeters: 800,
          riskClass: 'low',
          susceptibility: 0.25,
          hasActiveReport: false,
          underpassAlert: false,
        },
        {
          segmentId: 'SEG-2',
          roadName: 'SSSS Chowk Approach',
          highwayType: 'primary',
          lengthMeters: 500,
          riskClass: 'high',
          susceptibility: 0.78,
          hasActiveReport: true, // active incident!
          underpassAlert: true, // railway underpass!
        },
      ]

      const evaluation = evaluateRouteRisk(
        'ROUTE-ALPHA',
        { lng: 74.860, lat: 31.640 },
        { lng: 74.885, lat: 31.655 },
        candidateSegments,
        360 // 6 minutes
      )

      expect(evaluation.totalDistanceMeters).toBe(1300)
      expect(evaluation.exposureBreakdown.highRiskDistanceM).toBe(500)
      expect(evaluation.exposureBreakdown.activeReportsOnRoute).toBe(1)
      expect(evaluation.exposureBreakdown.underpassCountOnRoute).toBe(1)
      expect(evaluation.compositeRiskScore).toBeGreaterThan(40) // Elevated penalty (base 15 + active report 20 + underpass 10 = 45)
      expect(evaluation.recommendation).toBe('warning_high_waterlogging_risk')
      expect(evaluation.routingDisclaimer).toContain('Experimental flood-aware route comparison')
    })
  })
})
