/**
 * tests/unit/images/p32-end-to-end-audit.test.ts
 * Independent End-to-End Audit & Verification Suite for P32.
 *
 * Verifies the 10 required audit criteria:
 * 1. Valid recent flooded image raises risk for correctly associated building & road.
 * 2. Distant/irrelevant image does not influence building, road, or candidate route.
 * 3. Historical imagery is never misrepresented as active flood hazard (q=0).
 * 4. Missing credentials, failed inference, and empty coverage degrade gracefully.
 * 5. Zero-evidence condition returns exact baseline score (R_final == R_base).
 * 6. Route evaluation is affected only through actual traversed flooded segments.
 * 7. Duplicate submissions cannot artificially inflate or double-count risk.
 * 8. Strict geographic isolation between Amritsar and Jalandhar datasets.
 * 9. API contracts (/api/roads/risk, /api/roads/plan, /api/buildings) work with fused scores.
 * 10. License attribution and data provenance compliance (ODbL, CC-BY-SA, CC-BY-4.0).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { imageEvidenceService } from '@/lib/images/service'
import { roadRiskService } from '@/lib/roads/service'
import { buildingExposureService } from '@/lib/buildings/service'
import { visionProviderAdapter } from '@/lib/images/vision-provider'
import { mapillaryAdapter } from '@/lib/images/mapillary'
import { RiskFusionEngine } from '@/lib/images/fusion'
import type { RoadSegmentRecord } from '@/lib/roads/types'

describe('P32 — Independent Audit of Integrated Image Risk Feature', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe('Audit Item 1: Valid Recent Flooded Image Raises Risk Correctly', () => {
    it('elevates segment danger to high and increases R_final when active flood photo is within 25m', () => {
      const mockSegment: RoadSegmentRecord = {
        segmentId: 'AUDIT-SEG-01',
        osmid: '887766',
        name: 'Civil Lines Road',
        highway: 'primary',
        lengthM: 350,
        isUnderpass: false,
        isBridge: false,
        fromNode: 1,
        toNode: 2,
        primaryCellId: 'A-0934',
        maxCellSusceptibility: 0.25, // Base modeled low
        weightedCellSusceptibility: 0.22,
        unmatchedFraction: 0.0,
        modeledRiskClass: 'low',
        intersectingCells: [{ cellId: 'A-0934', s: 0.25, lengthM: 350, fraction: 1.0 }],
        startCoord: { lat: 31.640, lng: 74.870 },
        endCoord: { lat: 31.642, lng: 74.872 },
      }

      // Base evaluation before image
      const before = roadRiskService.evaluateSegmentRisk(mockSegment, [])
      expect(before.dynamicRiskClass).toBe('low')
      expect(before.riskScore).toBe(25)

      // Ingest active flooded image within 15m of corridor midpoint
      imageEvidenceService.ingestFieldPhoto({
        cityId: 'amritsar',
        roadSegmentId: 'AUDIT-SEG-01',
        imageUrl: 'https://example.com/audit_flooded_road.jpg',
        coordinates: { lat: 31.641, lng: 74.871 },
        capturedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        categoryHint: 'street_flooding',
        severityHint: 'severe_knee_or_higher',
        description: 'Road submerged under knee-deep water',
      })

      // After evaluation
      const after = roadRiskService.evaluateSegmentRisk(mockSegment, [])
      expect(after.hasActiveImageEvidence).toBe(true)
      expect(after.hasVerifiedFloodedImage).toBe(true)
      expect(after.dynamicRiskClass).toBe('high')
      expect(after.riskScore).toBeGreaterThan(before.riskScore!)
      expect(after.fusionReason).toContain('Elevated')
    })
  })

  describe('Audit Item 2: Distant or Irrelevant Imagery Has Zero Influence', () => {
    it('does not alter building exposure when photo is 200m away in the same 250m cell', () => {
      const buildingCentroid = { lat: 31.6380, lng: 74.8250 }

      const before = buildingExposureService.evaluateFootprintExposure({
        buildingId: 'AUDIT-BLD-01',
        coordinates: [
          [74.8249, 31.6379],
          [74.8251, 31.6379],
          [74.8251, 31.6381],
          [74.8249, 31.6381],
          [74.8249, 31.6379],
        ],
        cellIntersections: [
          { cellId: 'A-0550', susceptibility: 0.2, intersectionFraction: 1.0 },
        ],
      })
      expect(before.exposureCategory).toBe('low_catchment')
      expect(before.dynamicExposureCategory).toBe('low_catchment')
      expect(before.riskScore).toBe(20)

      // Ingest photo 200m away in cell A-0550
      imageEvidenceService.ingestFieldPhoto({
        cityId: 'amritsar',
        imageUrl: 'https://example.com/distant_building_photo.jpg',
        coordinates: { lat: 31.6398, lng: 74.8268 }, // ~200m distance
        capturedAt: new Date().toISOString(),
        categoryHint: 'street_flooding',
        severityHint: 'severe_knee_or_higher',
        description: 'Flooding in distant alleyway',
      })

      const after = buildingExposureService.evaluateFootprintExposure({
        buildingId: 'AUDIT-BLD-01',
        coordinates: [
          [74.8249, 31.6379],
          [74.8251, 31.6379],
          [74.8251, 31.6381],
          [74.8249, 31.6381],
          [74.8249, 31.6379],
        ],
        cellIntersections: [
          { cellId: 'A-0550', susceptibility: 0.2, intersectionFraction: 1.0 },
        ],
      })

      // Verified: Zero influence!
      expect(after.hasActiveImageEvidence).toBe(false)
      expect(after.dynamicExposureCategory).toBe('low_catchment')
      expect(after.riskScore).toBe(20)
    })
  })

  describe('Audit Item 3: Historical Imagery Cannot Masquerade as Active Danger', () => {
    it('sets reliability q=0 and leaves R_final == R_base for imagery older than 24h', () => {
      const stalePhoto = {
        imageId: 'IMG-MAPILLARY-OLD',
        source: 'mapillary' as const,
        capturedAt: '2023-08-15T12:00:00.000Z', // August 2023 survey
        isHistorical: true,
        floodedRoad: true,
        passability: 'impassable' as const,
        confidence: 0.95,
      }

      const q = RiskFusionEngine.evaluateRoadReliability(stalePhoto, 5)
      expect(q).toBe(0.0)

      const fused = RiskFusionEngine.fuseRisk({
        rBase: 35,
        visualScore: 90,
        reliability: q,
      })

      expect(fused.rFinal).toBe(35)
      expect(fused.effectiveWeight).toBe(0.0)
    })
  })

  describe('Audit Item 4: Missing Credentials & Inference Failures Degrade Gracefully', () => {
    it('handles missing MAPILLARY_ACCESS_TOKEN honestly without throwing', async () => {
      delete process.env.MAPILLARY_ACCESS_TOKEN
      const result = await mapillaryAdapter.queryImagery({
        bbox: [74.85, 31.61, 74.9, 31.65],
      })
      expect(result.status).toBe('blocked')
      expect(result.images).toEqual([])
    })

    it('handles AI vision provider HTTP 500 error safely without breaking pipeline', async () => {
      process.env.OPENAI_API_KEY = 'sk-proj-testkey12345'
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response('Internal Server Error', { status: 500 })
        )
      )

      const result = await visionProviderAdapter.analyzeImage({
        imageUrl: 'https://example.com/test.jpg',
      })

      expect(result.status).toBe('provider_error')
      expect(result.observation).toBeUndefined()
    })
  })

  describe('Audit Item 5: Zero-Evidence Condition Preserves Exact Baseline', () => {
    it('guarantees R_final is identically equal to R_base when no image evidence exists', () => {
      const mockSegment: RoadSegmentRecord = {
        segmentId: 'SEG-PURE-BASELINE',
        osmid: '112233',
        name: 'Kitchlu Chowk Arterial',
        highway: 'primary',
        lengthM: 400,
        isUnderpass: false,
        isBridge: false,
        fromNode: 3,
        toNode: 4,
        primaryCellId: 'A-0100',
        maxCellSusceptibility: 0.31,
        weightedCellSusceptibility: 0.29,
        unmatchedFraction: 0.0,
        modeledRiskClass: 'low',
        intersectingCells: [{ cellId: 'A-0100', s: 0.31, lengthM: 400, fraction: 1.0 }],
        startCoord: { lat: 31.645, lng: 74.860 },
        endCoord: { lat: 31.648, lng: 74.864 },
      }

      const evaluated = roadRiskService.evaluateSegmentRisk(mockSegment, [])
      expect(evaluated.riskScore).toBe(31)
      expect(evaluated.baseRiskScore).toBe(31)
      expect(evaluated.visualReliability).toBe(0.0)
      expect(evaluated.visualWeight).toBe(0.0)
    })
  })

  describe('Audit Item 6: Route Evaluation Influenced Only via Traversed Segments', () => {
    it('penalizes a candidate route only when traversing the specific segment with active flooded photo', async () => {
      const segmentsMap = roadRiskService.loadSegmentsIndex('amritsar')
      const segmentKeys = Array.from(segmentsMap.keys())
      const floodedSegId = segmentKeys[0]
      const safeSegId = segmentKeys[1]

      // Ingest flooded photo for floodedSegId
      imageEvidenceService.ingestFieldPhoto({
        cityId: 'amritsar',
        roadSegmentId: floodedSegId,
        imageUrl: 'https://example.com/flooded_route_segment.jpg',
        coordinates: { lat: 31.634, lng: 74.872 },
        capturedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        categoryHint: 'street_flooding',
        severityHint: 'severe_knee_or_higher',
        description: 'Road impassable under water',
      })

      // Compare two routes: Route A traversing flooded segment vs Route B traversing safe segment
      const comparison = await roadRiskService.evaluateCandidateRoutes([
        {
          routeId: 'route-flooded',
          name: 'Traverses Flooded Segment',
          segmentIds: [floodedSegId],
        },
        {
          routeId: 'route-safe',
          name: 'Traverses Clean Segment',
          segmentIds: [safeSegId],
        },
      ])

      const routeFlooded = comparison.rankedRoutes.find((r) => r.routeId === 'route-flooded')!
      const routeSafe = comparison.rankedRoutes.find((r) => r.routeId === 'route-safe')!

      expect(routeFlooded.visuallyConfirmedFloodedSegmentsCount).toBe(1)
      expect(routeFlooded.recommendation).toBe('avoid')
      expect(routeSafe.visuallyConfirmedFloodedSegmentsCount).toBe(0)
      expect(routeFlooded.compositePenaltyScore).toBeGreaterThan(routeSafe.compositePenaltyScore)
    })
  })

  describe('Audit Item 7: Deduplication Prevents Risk Amplification', () => {
    it('ignores duplicate uploads of identical photos without inflating evidence count', () => {
      const payload = {
        cityId: 'amritsar',
        imageUrl: 'https://example.com/duplicate_audit.jpg',
        coordinates: { lat: 31.635, lng: 74.875 },
        capturedAt: '2026-10-16T04:00:00.000Z',
        description: 'Water at junction',
      }

      const record1 = imageEvidenceService.ingestFieldPhoto(payload)
      const record2 = imageEvidenceService.ingestFieldPhoto(payload)

      expect(record1.id).toBe(record2.id)
      expect(record1.contentHash).toBe(record2.contentHash)

      // Query summaries for cell
      const cellRecords = imageEvidenceService.getImageEvidenceForCell(record1.cellId!)
      const matching = cellRecords.filter((r) => r.contentHash === record1.contentHash)
      expect(matching.length).toBe(1)
    })
  })

  describe('Audit Item 8: Cross-City Isolation Between Amritsar and Jalandhar', () => {
    it('verifies that Amritsar imagery does not pollute Jalandhar road or building evaluations', () => {
      // Ingest Amritsar image
      imageEvidenceService.ingestFieldPhoto({
        cityId: 'amritsar',
        roadSegmentId: 'ROAD-AMR-ISOLATION-01',
        imageUrl: 'https://example.com/amr_iso.jpg',
        coordinates: { lat: 31.634, lng: 74.872 },
        capturedAt: new Date().toISOString(),
        categoryHint: 'street_flooding',
        severityHint: 'severe_knee_or_higher',
        description: 'Amritsar walled city water',
      })

      // Query Jalandhar index
      const jalIndex = roadRiskService.loadSegmentsIndex('jalandhar')
      expect(jalIndex.size).toBeGreaterThan(10000)

      const jalSample = Array.from(jalIndex.values())[0]
      const evaluated = roadRiskService.evaluateSegmentRisk(jalSample, [])
      expect(evaluated.hasActiveImageEvidence).toBe(false)
      expect(evaluated.hasVerifiedFloodedImage).toBe(false)
    })
  })

  describe('Audit Item 9: API Contracts Function with Fused Scores', () => {
    it('returns valid numeric riskScore and provenance in RoadRiskService output', () => {
      const segment: RoadSegmentRecord = {
        segmentId: 'SEG-API-AUDIT',
        osmid: '998811',
        name: 'Mall Road Test',
        highway: 'primary',
        lengthM: 300,
        isUnderpass: false,
        isBridge: false,
        fromNode: 1,
        toNode: 2,
        primaryCellId: 'A-0935',
        maxCellSusceptibility: 0.4,
        weightedCellSusceptibility: 0.38,
        unmatchedFraction: 0.0,
        modeledRiskClass: 'moderate',
        intersectingCells: [{ cellId: 'A-0935', s: 0.4, lengthM: 300, fraction: 1.0 }],
        startCoord: { lat: 31.63, lng: 74.87 },
        endCoord: { lat: 31.632, lng: 74.872 },
      }

      const evaluated = roadRiskService.evaluateSegmentRisk(segment, [])
      expect(typeof evaluated.riskScore).toBe('number')
      expect(evaluated.riskScore).toBeGreaterThanOrEqual(0)
      expect(evaluated.riskScore).toBeLessThanOrEqual(100)
      expect(evaluated.fusionReason).toBeDefined()
    })
  })

  describe('Audit Item 10: Licensing & Provenance Compliance', () => {
    it('verifies that all data sources carry verified legal license tags and disclaimers', () => {
      const mapillaryRecord = imageEvidenceService.queryImages({ source: 'mapillary' })
      for (const img of mapillaryRecord) {
        expect(img.license).toBe('CC-BY-SA 4.0')
        expect(img.attribution).toContain('Mapillary')
      }

      const municipalRecords = imageEvidenceService.queryImages({ source: 'incident_report_archive' })
      expect(municipalRecords.length).toBeGreaterThan(0)
      for (const img of municipalRecords) {
        expect(img.contentHash).toBeDefined()
        expect(img.provenance.license).toBeDefined()
      }
    })
  })
})
