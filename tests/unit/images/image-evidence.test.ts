/**
 * tests/unit/images/image-evidence.test.ts
 * Rigorous Unit & Integration Tests for P29 Image Evidence Architecture.
 *
 * Verifies:
 * 1. Mapillary API token handling, honest blocker behavior, and response normalization.
 * 2. Temporal stratification: old street photos are marked isHistorical: true and never trigger current alerts.
 * 3. FloodNet & FloodRescue-AI adapted visual classification and passability scoring.
 * 4. Open satellite remote-sensing feasibility & cloud-blindness assessment.
 * 5. Image evidence integration with RoadRiskService (evaluating segment risk and route penalties).
 * 6. Image evidence integration with BuildingExposureService (evaluating building dynamic exposure).
 * 7. Deduplication via SHA-256 content hashing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FloodImageAnalyzer } from '@/lib/images/analyzer'
import { mapillaryAdapter } from '@/lib/images/mapillary'
import { satelliteRemoteSensingService } from '@/lib/images/satellite'
import { imageEvidenceService } from '@/lib/images/service'
import { INCIDENT_IMAGE_ARCHIVE } from '@/lib/images/incident-archive'
import { roadRiskService } from '@/lib/roads/service'
import { buildingExposureService } from '@/lib/buildings/service'
import type { RoadSegmentRecord } from '@/lib/roads/types'

describe('P29 — Image Evidence Integration Architecture', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe('1. Mapillary API Adapter & Blocker Honesty', () => {
    it('returns honest blocked status without inventing fake images when MAPILLARY_ACCESS_TOKEN is missing', async () => {
      delete process.env.MAPILLARY_ACCESS_TOKEN

      const result = await mapillaryAdapter.queryImagery({
        bbox: [74.85, 31.61, 74.9, 31.65],
        cityId: 'amritsar',
      })

      expect(result.status).toBe('blocked')
      expect(result.totalFetched).toBe(0)
      expect(result.images).toEqual([])
      expect(result.reason).toContain('MAPILLARY_ACCESS_TOKEN is not configured')
    })

    it('rejects known template placeholders as unconfigured', async () => {
      process.env.MAPILLARY_ACCESS_TOKEN = 'your-key-here'

      const result = await mapillaryAdapter.queryImagery({
        bbox: [74.85, 31.61, 74.9, 31.65],
      })

      expect(result.status).toBe('blocked')
      expect(result.totalFetched).toBe(0)
    })

    it('successfully parses Mapillary Graph API response and applies CC-BY-SA 4.0 license when token is valid', async () => {
      process.env.MAPILLARY_ACCESS_TOKEN = 'MLY|987654321|test_valid_token'

      const mockData = {
        data: [
          {
            id: '1234567890',
            computed_geometry: {
              coordinates: [74.872, 31.634],
            },
            captured_at: Date.now() - 365 * 24 * 3600 * 1000, // 1 year ago (historical survey)
            thumb_1024_url: 'https://images.mapillary.com/1024.jpg',
            thumb_256_url: 'https://images.mapillary.com/256.jpg',
            creator: { username: 'punjab_surveyor' },
          },
        ],
      }

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify(mockData), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      )

      const result = await mapillaryAdapter.queryImagery({
        bbox: [74.85, 31.61, 74.9, 31.65],
        cityId: 'amritsar',
      })

      expect(result.status).toBe('ok')
      expect(result.totalFetched).toBe(1)
      const record = result.images[0]
      expect(record.id).toBe('MAPILLARY-1234567890')
      expect(record.source).toBe('mapillary')
      expect(record.license).toBe('CC-BY-SA-4.0')
      expect(record.attribution).toContain('punjab_surveyor')
      expect(record.contentHash).toBeDefined()
      // Survey taken 1 year ago MUST be flagged historical
      expect(record.isHistorical).toBe(true)
      expect(record.scientificCaveat).toContain('Historical baseline street-level survey')
    })
  })

  describe('2. Temporal Stratification & Historical Distinction', () => {
    it('distinguishes historical baseline survey photos from current storm observations', () => {
      const ancientTime = new Date(Date.now() - 48 * 3600 * 1000).toISOString() // 48h ago
      const recentTime = new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 mins ago

      const historicalPhoto = imageEvidenceService.ingestFieldPhoto({
        cityId: 'amritsar',
        imageUrl: 'https://example.com/ancient.jpg',
        coordinates: { lat: 31.634, lng: 74.872 },
        capturedAt: ancientTime,
        categoryHint: 'street_flooding',
        severityHint: 'severe_knee_or_higher',
      })

      const currentPhoto = imageEvidenceService.ingestFieldPhoto({
        cityId: 'amritsar',
        imageUrl: 'https://example.com/fresh.jpg',
        coordinates: { lat: 31.634, lng: 74.872 },
        capturedAt: recentTime,
        categoryHint: 'street_flooding',
        severityHint: 'severe_knee_or_higher',
      })

      expect(historicalPhoto.isHistorical).toBe(true)
      expect(currentPhoto.isHistorical).toBe(false)
    })
  })

  describe('3. FloodNet & FloodRescue-AI Visual Classification', () => {
    it('accurately classifies severe road waterlogging and impassable status from FloodNet labels', () => {
      const analysis = FloodImageAnalyzer.analyze({
        categoryHint: 'underpass_submersion',
        severityHint: 'severe_knee_or_higher',
        description: 'SSSS Chowk underpass submerged with knee-deep water, traffic impassable for cars',
      })

      expect(analysis.waterDetected).toBe(true)
      expect(analysis.floodedRoad).toBe(true)
      expect(analysis.passability).toBe('impassable')
      expect(analysis.estimatedWaterDepth).toBe('impassable')
      expect(analysis.confidence).toBeGreaterThanOrEqual(0.85)
      expect(analysis.detectedClasses).toContain('water')
      expect(analysis.detectedClasses).toContain('flooded_road')
    })

    it('accurately identifies building proximity waterlogging (FloodNet Class 1)', () => {
      const analysis = FloodImageAnalyzer.analyze({
        categoryHint: 'street_flooding',
        severityHint: 'moderate_ankle',
        description: 'Water ponding outside GNDU building gates and doorstep',
      })

      expect(analysis.waterDetected).toBe(true)
      expect(analysis.floodedBuilding).toBe(true)
      expect(analysis.passability).toBe('caution')
      expect(analysis.estimatedWaterDepth).toBe('ankle_deep')
    })

    it('evaluates clear non-flooded conditions with high confidence', () => {
      const analysis = FloodImageAnalyzer.analyze({
        description: 'Dry asphalt road under clear skies, normal traffic flow',
      })

      expect(analysis.waterDetected).toBe(false)
      expect(analysis.floodedRoad).toBe(false)
      expect(analysis.passability).toBe('passable')
      expect(analysis.estimatedWaterDepth).toBe('none')
      expect(analysis.confidence).toBe(0.9)
    })
  })

  describe('4. Satellite Remote-Sensing Suitability Analysis', () => {
    it('scientifically assesses Sentinel-2 as unsuitable for real-time urban street flooding due to cloud blindness', () => {
      const constellations = satelliteRemoteSensingService.evaluateConstellations()
      const s2 = constellations.find((c) => c.sensor.includes('Sentinel-2'))

      expect(s2).toBeDefined()
      expect(s2?.urbanStreetFeasibility).toBe('unsuitable')
      expect(s2?.cloudPenetration).toBe(false)
      expect(s2?.limitations.some((l) => l.includes('cloud'))).toBe(true)
    })

    it('scientifically assesses Sentinel-1 SAR as unsuitable for real-time alerts due to 12-day revisit latency', () => {
      const constellations = satelliteRemoteSensingService.evaluateConstellations()
      const s1 = constellations.find((c) => c.sensor.includes('Sentinel-1'))

      expect(s1).toBeDefined()
      expect(s1?.cloudPenetration).toBe(true)
      expect(s1?.urbanStreetFeasibility).toBe('unsuitable')
      expect(s1?.revisitIntervalDays).toBe(12)
    })

    it('isSuitableForRealTimeUrbanRisk returns honest false with clear alternative', () => {
      const assessment = satelliteRemoteSensingService.isSuitableForRealTimeUrbanRisk()
      expect(assessment.suitable).toBe(false)
      expect(assessment.primaryReason).toContain('cloud blindness')
      expect(assessment.preferredAlternative).toContain('Street-level')
    })
  })

  describe('5. Road Risk System Integration (RoadRiskService)', () => {
    const mockSegment: RoadSegmentRecord = {
      segmentId: 'osm-test-seg-100',
      osmid: '99887766',
      name: 'Mall Road Test Corridor',
      highway: 'primary',
      lengthM: 350,
      isUnderpass: false,
      isBridge: false,
      fromNode: 1,
      toNode: 2,
      primaryCellId: 'A-0935',
      maxCellSusceptibility: 0.25, // Naturally low modeled susceptibility
      weightedCellSusceptibility: 0.22,
      unmatchedFraction: 0.0,
      modeledRiskClass: 'low',
      intersectingCells: [{ cellId: 'A-0935', s: 0.25, lengthM: 350, fraction: 1.0 }],
      startCoord: { lat: 31.63, lng: 74.87 },
      endCoord: { lat: 31.632, lng: 74.872 },
    }

    it('evaluates baseline segment as low risk when no active image evidence exists', () => {
      const evaluated = roadRiskService.evaluateSegmentRisk(mockSegment, [])
      expect(evaluated.modeledRiskClass).toBe('low')
      expect(evaluated.dynamicRiskClass).toBe('low')
      expect(evaluated.hasActiveImageEvidence).toBe(false)
    })

    it('elevates road dynamic risk to HIGH when active flooded image evidence is attached', () => {
      // Ingest active image evidence for this segment
      imageEvidenceService.ingestFieldPhoto({
        cityId: 'amritsar',
        roadSegmentId: 'osm-test-seg-100',
        imageUrl: 'https://example.com/flood_road.jpg',
        coordinates: { lat: 31.631, lng: 74.871 },
        capturedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 mins ago
        categoryHint: 'street_flooding',
        severityHint: 'severe_knee_or_higher',
        description: 'Road impassable due to knee-deep floodwater',
      })

      const evaluated = roadRiskService.evaluateSegmentRisk(mockSegment, [])
      expect(evaluated.hasActiveImageEvidence).toBe(true)
      expect(evaluated.hasVerifiedFloodedImage).toBe(true)
      expect(evaluated.dynamicRiskClass).toBe('high')
      expect(evaluated.imageEvidence?.length).toBeGreaterThanOrEqual(1)
    })

    it('penalizes candidate route score and marks recommendation: avoid when traversing visually flooded road', async () => {
      const segmentsMap = roadRiskService.loadSegmentsIndex('amritsar')
      const targetSegmentId = Array.from(segmentsMap.keys())[0]

      imageEvidenceService.ingestFieldPhoto({
        cityId: 'amritsar',
        roadSegmentId: targetSegmentId,
        imageUrl: 'https://example.com/flood_route_seg.jpg',
        coordinates: { lat: 31.631, lng: 74.871 },
        capturedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        categoryHint: 'street_flooding',
        severityHint: 'severe_knee_or_higher',
        description: 'Road impassable due to knee-deep floodwater',
      })

      const result = await roadRiskService.evaluateCandidateRoutes([
        {
          routeId: 'route-test-image',
          name: 'Route Traversing Visually Flooded Road',
          segmentIds: [targetSegmentId],
        },
      ])

      expect(result.rankedRoutes.length).toBe(1)
      const route = result.rankedRoutes[0]
      expect(route.visuallyConfirmedFloodedSegmentsCount).toBe(1)
      expect(route.recommendation).toBe('avoid')
      expect(route.explanation).toContain('visually confirmed flooded road segment')
      expect(route.compositePenaltyScore).toBeGreaterThanOrEqual(25)
    })
  })

  describe('6. Building Risk System Integration (BuildingExposureService)', () => {
    it('associates active image evidence with building exposure and elevates dynamic exposure category', () => {
      // Ingest active image in cell A-0935 where building is located
      imageEvidenceService.ingestFieldPhoto({
        cityId: 'amritsar',
        buildingId: 'GOB-TEST-BUILDING-001',
        imageUrl: 'https://example.com/building_inundated.jpg',
        coordinates: { lat: 31.631, lng: 74.876 },
        capturedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        categoryHint: 'street_flooding',
        severityHint: 'moderate_ankle',
        description: 'Water accumulated at building doorstep and campus',
      })

      const evaluation = buildingExposureService.evaluateFootprintExposure({
        buildingId: 'GOB-TEST-BUILDING-001',
        coordinates: [
          [74.876, 31.631],
          [74.8762, 31.631],
          [74.8762, 31.6312],
          [74.876, 31.6312],
          [74.876, 31.631],
        ],
        cellIntersections: [
          {
            cellId: 'A-0935',
            susceptibility: 0.2, // Modeled low catchment
            intersectionFraction: 1.0,
          },
        ],
      })

      expect(evaluation.exposureCategory).toBe('low_catchment') // Modeled static baseline preserved
      expect(evaluation.hasActiveImageEvidence).toBe(true)
      expect(evaluation.imageConfirmedFlooding).toBe(true)
      expect(evaluation.dynamicExposureCategory).toBe('high_catchment') // Elevated due to ground-truth visual proof
      expect(evaluation.imageEvidence?.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('7. Deduplication & Content Hash Integrity', () => {
    it('deduplicates identical image submissions via deterministic SHA-256 content hash', () => {
      const fixedTime = '2026-10-16T04:00:00.000Z'
      const coords = { lat: 31.635, lng: 74.875 }

      const first = imageEvidenceService.ingestFieldPhoto({
        cityId: 'amritsar',
        imageUrl: 'https://example.com/dedup_test.jpg',
        coordinates: coords,
        capturedAt: fixedTime,
      })

      const second = imageEvidenceService.ingestFieldPhoto({
        cityId: 'amritsar',
        imageUrl: 'https://example.com/dedup_test.jpg',
        coordinates: coords,
        capturedAt: fixedTime,
      })

      expect(first.contentHash).toBe(second.contentHash)
      expect(first.id).toBe(second.id)
    })

    it('pre-seeds incident image archive with verified content hashes and timestamps', () => {
      expect(INCIDENT_IMAGE_ARCHIVE.length).toBeGreaterThanOrEqual(3)
      for (const img of INCIDENT_IMAGE_ARCHIVE) {
        expect(img.contentHash).toBeDefined()
        expect(img.contentHash.length).toBe(64) // SHA-256 hex string length
        expect(img.isHistorical).toBe(true)
        expect(img.attribution).toBeDefined()
        expect(img.license).toBeDefined()
      }
    })
  })
})
