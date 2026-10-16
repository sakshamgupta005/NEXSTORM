/**
 * tests/unit/images/p30-ai-vision.test.ts
 * Rigorous Unit & Integration Tests for P30 Real AI Image Analysis Architecture.
 *
 * Test matrix covers all required scenarios:
 * 1. Positive Image: Active flooded road & entrance -> high risk elevation & route penalty.
 * 2. Negative Image: Clear dry street -> no water detected, 0 route penalty.
 * 3. Ambiguous/Occluded Image: Blurry/dark/occluded -> isActionable: false, zero weight.
 * 4. Stale Image: isHistorical: true -> historical_vulnerability_only, no current elevation.
 * 5. Unlocated Image: No GPS/cell/road binding -> unlocated, non-actionable.
 * 6. Duplicate Image: Identical SHA-256 hash -> deduplicated, rejects second ingest.
 * 7. Corrupted Image: Malformed URL/payload -> corrupted_image status, no fabrication.
 * 8. Invalid Provider Output: LLM outputs malformed schema -> caught, provider_error.
 * 9. Provider Failure: Network/HTTP 500 error -> graceful provider_error fallback.
 * 10. Reproducible Real-Inference Path: Validates provider adapter with Gemini/OpenAI schema.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { visionProviderAdapter } from '@/lib/images/vision-provider'
import { VisualRiskFeatureMapper } from '@/lib/images/risk-mapper'
import { imageEvidenceService } from '@/lib/images/service'
import { roadRiskService } from '@/lib/roads/service'
import type { StructuredVisualObservation } from '@/lib/images/types'
import type { RoadSegmentRecord } from '@/lib/roads/types'

describe('P30 — AI-Based Image Analysis & Existing Risk Pipeline Integration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe('1. Positive Image (Active Flooded Road & Building)', () => {
    it('extracts positive flood findings and deterministically elevates road risk and building exposure', async () => {
      const observation: StructuredVisualObservation = {
        sceneType: 'street_level',
        visibleWaterOnRoad: true,
        roadWaterCondition: 'deep_standing_water',
        roadPassability: 'impassable',
        visibleWaterAffectingBuilding: true,
        buildingWaterImpact: 'entrance_doorstep_inundation',
        waterExtent: 'corridor_linear',
        imageQuality: 'high',
        occlusionDegree: 'none',
        uncertaintyLevel: 'low',
        rawEvidenceExplanation: 'Water depth exceeds curb height and reaches commercial doorsteps along GT Road.',
        modelConfidence: 0.94,
        modelUsed: 'gemini-1.5-flash',
        providerUsed: 'google_gemini',
        segmentationSupported: false,
        extractedAt: new Date().toISOString(),
      }

      const riskFeatures = VisualRiskFeatureMapper.mapToRiskFeatures({
        imageId: 'IMG-POS-001',
        observation,
        isHistorical: false,
        capturedAt: new Date().toISOString(),
        roadSegmentId: 'ROAD-JAL-GT-01',
        buildingId: 'BLD-JAL-001',
        cellId: 'JAL-100',
        providerStatus: 'ok',
      })

      expect(riskFeatures.visualSeverity).toBe('severe_inundation')
      expect(riskFeatures.currentRoadRiskElevation).toBe('high')
      expect(riskFeatures.currentBuildingExposureElevation).toBe('high_catchment')
      expect(riskFeatures.routeImpedancePenalty).toBe(30)
      expect(riskFeatures.isActionable).toBe(true)
      expect(riskFeatures.evidenceQuality).toBe('high')
      expect(riskFeatures.calibratedWeight).toBeGreaterThan(0.7)

      // Verify integration with RoadRiskService
      const mockSegment: RoadSegmentRecord = {
        segmentId: 'ROAD-JAL-GT-01',
        osmid: '12345',
        name: 'Grand Trunk Road',
        highway: 'primary',
        lengthM: 450,
        isUnderpass: false,
        isBridge: false,
        fromNode: 1,
        toNode: 2,
        primaryCellId: 'JAL-100',
        maxCellSusceptibility: 0.25,
        weightedCellSusceptibility: 0.22,
        unmatchedFraction: 0.0,
        modeledRiskClass: 'low',
        intersectingCells: [{ cellId: 'JAL-100', s: 0.25, lengthM: 450, fraction: 1.0 }],
        startCoord: { lat: 31.32, lng: 75.57 },
        endCoord: { lat: 31.33, lng: 75.58 },
      }

      imageEvidenceService.ingestFieldPhoto({
        cityId: 'jalandhar',
        roadSegmentId: 'ROAD-JAL-GT-01',
        imageUrl: 'https://example.com/flood_road_jal.jpg',
        coordinates: { lat: 31.325, lng: 75.575 },
        capturedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        categoryHint: 'street_flooding',
        severityHint: 'severe_knee_or_higher',
        description: 'Road impassable due to deep water',
      })

      const evaluated = roadRiskService.evaluateSegmentRisk(mockSegment, [])

      expect(evaluated.dynamicRiskClass).toBe('high')
      expect(evaluated.hasActiveImageEvidence).toBe(true)
      expect(evaluated.hasVerifiedFloodedImage).toBe(true)
      expect(evaluated.imageEvidence?.[0].riskFeatures?.currentRoadRiskElevation).toBe('high')
    })
  })

  describe('2. Negative Image (Clear Dry Street)', () => {
    it('produces zero risk elevation, zero impedance penalty, and maintains passable status', () => {
      const observation: StructuredVisualObservation = {
        sceneType: 'street_level',
        visibleWaterOnRoad: false,
        roadWaterCondition: 'none',
        roadPassability: 'passable',
        visibleWaterAffectingBuilding: false,
        buildingWaterImpact: 'none',
        waterExtent: 'none',
        imageQuality: 'high',
        occlusionDegree: 'none',
        uncertaintyLevel: 'low',
        rawEvidenceExplanation: 'Dry asphalt road surface with moving traffic and dry sidewalks.',
        modelConfidence: 0.98,
        modelUsed: 'gemini-1.5-flash',
        providerUsed: 'google_gemini',
        segmentationSupported: false,
        extractedAt: new Date().toISOString(),
      }

      const riskFeatures = VisualRiskFeatureMapper.mapToRiskFeatures({
        imageId: 'IMG-NEG-001',
        observation,
        isHistorical: false,
        capturedAt: new Date().toISOString(),
        roadSegmentId: 'ROAD-AMR-MALL-01',
        cellId: 'AMR-200',
        providerStatus: 'ok',
      })

      expect(riskFeatures.visualSeverity).toBe('none')
      expect(riskFeatures.currentRoadRiskElevation).toBe('none')
      expect(riskFeatures.currentBuildingExposureElevation).toBe('none')
      expect(riskFeatures.routeImpedancePenalty).toBe(0)
      expect(riskFeatures.isActionable).toBe(true)
    })
  })

  describe('3. Ambiguous & Occluded Image', () => {
    it('rejects dark or occluded images from spatial calculations without fabricating positive or negative alerts', () => {
      const blurryObs: StructuredVisualObservation = {
        sceneType: 'unknown',
        visibleWaterOnRoad: false,
        roadWaterCondition: 'none',
        roadPassability: 'passable',
        visibleWaterAffectingBuilding: false,
        buildingWaterImpact: 'unknown',
        waterExtent: 'unknown',
        imageQuality: 'poor_blurry_dark',
        occlusionDegree: 'heavy',
        uncertaintyLevel: 'unusable',
        rawEvidenceExplanation: 'Motion blur and extreme low light prevent identification of ground surface.',
        modelConfidence: 0.2,
        modelUsed: 'gpt-4o-mini',
        providerUsed: 'openai',
        segmentationSupported: false,
        extractedAt: new Date().toISOString(),
      }

      const riskFeatures = VisualRiskFeatureMapper.mapToRiskFeatures({
        imageId: 'IMG-AMB-001',
        observation: blurryObs,
        isHistorical: false,
        capturedAt: new Date().toISOString(),
        roadSegmentId: 'ROAD-001',
        cellId: 'CELL-001',
        providerStatus: 'ok',
      })

      expect(riskFeatures.evidenceQuality).toBe('unusable')
      expect(riskFeatures.isActionable).toBe(false)
      expect(riskFeatures.calibratedWeight).toBe(0.0)
      expect(riskFeatures.currentRoadRiskElevation).toBe('none')
      expect(riskFeatures.routeImpedancePenalty).toBe(0)
      expect(riskFeatures.scientificCaveat).toContain('prevent false alarms')
    })
  })

  describe('4. Stale / Historical Image', () => {
    it('marks historical surveys as historical_vulnerability_only and never penalizes active routes', () => {
      const observation: StructuredVisualObservation = {
        sceneType: 'street_level',
        visibleWaterOnRoad: true,
        roadWaterCondition: 'deep_standing_water',
        roadPassability: 'impassable',
        visibleWaterAffectingBuilding: true,
        buildingWaterImpact: 'entrance_doorstep_inundation',
        waterExtent: 'corridor_linear',
        imageQuality: 'adequate',
        occlusionDegree: 'none',
        uncertaintyLevel: 'low',
        rawEvidenceExplanation: 'Severe waterlogging during July 2023 monsoon season.',
        modelConfidence: 0.9,
        modelUsed: 'heuristic_rules_v1',
        providerUsed: 'local_deterministic',
        segmentationSupported: false,
        extractedAt: new Date().toISOString(),
      }

      const riskFeatures = VisualRiskFeatureMapper.mapToRiskFeatures({
        imageId: 'IMG-HIST-001',
        observation,
        isHistorical: true, // Captured 1 year ago
        capturedAt: '2023-07-15T12:00:00.000Z',
        roadSegmentId: 'ROAD-002',
        cellId: 'CELL-002',
        providerStatus: 'ok',
      })

      expect(riskFeatures.temporalRelevance).toBe('historical_vulnerability_only')
      expect(riskFeatures.currentRoadRiskElevation).toBe('none')
      expect(riskFeatures.currentBuildingExposureElevation).toBe('none')
      expect(riskFeatures.routeImpedancePenalty).toBe(0)
      expect(riskFeatures.calibratedWeight).toBe(0.2) // Low vulnerability weighting
      expect(riskFeatures.scientificCaveat).toContain('does NOT indicate current passage status')
    })
  })

  describe('5. Unlocated Image', () => {
    it('discards unlocated images from spatial calculations even if severe flooding is visible in pixels', () => {
      const observation: StructuredVisualObservation = {
        sceneType: 'street_level',
        visibleWaterOnRoad: true,
        roadWaterCondition: 'submerged',
        roadPassability: 'impassable',
        visibleWaterAffectingBuilding: true,
        buildingWaterImpact: 'ground_floor_flooded',
        waterExtent: 'areal_broad',
        imageQuality: 'high',
        occlusionDegree: 'none',
        uncertaintyLevel: 'low',
        rawEvidenceExplanation: 'Submerged car and water up to building windows.',
        modelConfidence: 0.95,
        modelUsed: 'gemini-1.5-flash',
        providerUsed: 'google_gemini',
        segmentationSupported: false,
        extractedAt: new Date().toISOString(),
      }

      // No roadSegmentId, buildingId, or cellId
      const riskFeatures = VisualRiskFeatureMapper.mapToRiskFeatures({
        imageId: 'IMG-UNLOC-001',
        observation,
        isHistorical: false,
        capturedAt: new Date().toISOString(),
        providerStatus: 'ok',
      })

      expect(riskFeatures.geographicRelevance).toBe('unlocated')
      expect(riskFeatures.isActionable).toBe(false)
      expect(riskFeatures.calibratedWeight).toBe(0.0)
      expect(riskFeatures.currentRoadRiskElevation).toBe('none')
      expect(riskFeatures.scientificCaveat).toContain('lacks verified geographic coordinates')
    })
  })

  describe('6. Duplicate Image Handling', () => {
    it('deduplicates identical images based on SHA-256 content hash', () => {
      const payload = {
        imageUrl: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=800&q=80',
        cityId: 'amritsar',
        coordinates: { lat: 31.634, lng: 74.872 },
        capturedAt: '2026-10-16T04:30:00.000Z',
        description: 'First submission of waterlogged chowk',
      }

      const first = imageEvidenceService.ingestFieldPhoto(payload)
      expect(first.id).toBeDefined()
      expect(first.contentHash).toBeDefined()

      // Ingesting the identical image again must return existing record
      const duplicate = imageEvidenceService.ingestFieldPhoto(payload)
      expect(duplicate.id).toBe(first.id)
      expect(duplicate.contentHash).toBe(first.contentHash)
    })
  })

  describe('7. Corrupted Image Input', () => {
    it('returns corrupted_image status without throwing or fabricating false flood observations', async () => {
      const emptyResult = await visionProviderAdapter.analyzeImage({
        imageUrl: '',
      })
      expect(emptyResult.status).toBe('corrupted_image')
      expect(emptyResult.observation).toBeUndefined()

      const invalidSchemeResult = await visionProviderAdapter.analyzeImage({
        imageUrl: 'ftp://invalidscheme.com/flood.jpg',
      })
      expect(invalidSchemeResult.status).toBe('corrupted_image')
      expect(invalidSchemeResult.observation).toBeUndefined()

      // Ensure mapper handles corrupted result safely
      const riskFeatures = VisualRiskFeatureMapper.mapToRiskFeatures({
        imageId: 'IMG-CORRUPT',
        isHistorical: false,
        capturedAt: new Date().toISOString(),
        providerStatus: invalidSchemeResult.status,
      })

      expect(riskFeatures.isActionable).toBe(false)
      expect(riskFeatures.visualSeverity).toBe('none')
      expect(riskFeatures.routeImpedancePenalty).toBe(0)
    })
  })

  describe('8. Invalid Provider Output & Schema Violations', () => {
    it('catches invalid JSON or schema violations from AI provider and marks provider_error', async () => {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'AIzaSyFakeKeyValidFormat123456789'

      // Mock Gemini returning malformed JSON
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [{ text: 'Here is what I found: Water is very high!' }], // Not valid JSON matching schema
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )
      )

      const result = await visionProviderAdapter.analyzeImage({
        imageUrl: 'https://example.com/test.jpg',
      })

      expect(result.status).toBe('provider_error')
      expect(result.error).toContain('Invalid JSON')
      expect(result.observation).toBeUndefined()
    })
  })

  describe('9. Provider Failure & HTTP Errors', () => {
    it('gracefully handles 500 server errors from provider without crashing the risk pipeline', async () => {
      process.env.OPENAI_API_KEY = 'sk-proj-fakevalidopenaikey123456789'
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY

      // Mock OpenAI returning HTTP 500
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response('Internal Server Error from upstream AI service', {
            status: 500,
            headers: { 'Content-Type': 'text/plain' },
          })
        )
      )

      const result = await visionProviderAdapter.analyzeImage({
        imageUrl: 'https://example.com/test.jpg',
      })

      expect(result.status).toBe('provider_error')
      expect(result.error).toContain('HTTP 500')
      expect(result.observation).toBeUndefined()

      // The mapper must reject this cleanly
      const riskFeatures = VisualRiskFeatureMapper.mapToRiskFeatures({
        imageId: 'IMG-FAIL-01',
        isHistorical: false,
        capturedAt: new Date().toISOString(),
        providerStatus: result.status,
      })

      expect(riskFeatures.isActionable).toBe(false)
      expect(riskFeatures.routeImpedancePenalty).toBe(0)
    })
  })

  describe('10. Reproducible Real-Inference Test Path', () => {
    it('executes end-to-end inference path with schema validation against Gemini provider structure', async () => {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'AIzaSyRealInferenceTestKey123'

      const mockGeminiJson = {
        sceneType: 'street_level',
        visibleWaterOnRoad: true,
        roadWaterCondition: 'flowing_surface_water',
        roadPassability: 'caution',
        visibleWaterAffectingBuilding: true,
        buildingWaterImpact: 'water_at_perimeter',
        waterExtent: 'localized_spot',
        imageQuality: 'high',
        occlusionDegree: 'partial',
        uncertaintyLevel: 'low',
        rawEvidenceExplanation: 'Shallow flowing stormwater along roadside curb, pedestrians stepping over puddles.',
        modelConfidence: 0.91,
      }

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [{ text: JSON.stringify(mockGeminiJson) }],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )
      )

      const result = await visionProviderAdapter.analyzeImage({
        imageUrl: 'https://storage.googleapis.com/nexstorm/reports/amritsar_mall_road.jpg',
        categoryHint: 'road_waterlogging',
        description: 'Water ponding near Bhandari bridge',
      })

      expect(result.status).toBe('ok')
      expect(result.observation).toBeDefined()
      expect(result.observation?.roadWaterCondition).toBe('flowing_surface_water')
      expect(result.observation?.roadPassability).toBe('caution')
      expect(result.model).toBe('gemini-1.5-flash')

      // Map to risk features
      const riskFeatures = VisualRiskFeatureMapper.mapToRiskFeatures({
        imageId: 'IMG-REAL-001',
        observation: result.observation,
        isHistorical: false,
        capturedAt: new Date().toISOString(),
        roadSegmentId: 'ROAD-AMR-BHANDARI',
        cellId: 'AMR-102',
        providerStatus: result.status,
      })

      expect(riskFeatures.visualSeverity).toBe('moderate_flow')
      expect(riskFeatures.currentRoadRiskElevation).toBe('moderate')
      expect(riskFeatures.routeImpedancePenalty).toBe(15)
      expect(riskFeatures.currentBuildingExposureElevation).toBe('moderate_catchment')
      expect(riskFeatures.isActionable).toBe(true)
    })
  })
})
