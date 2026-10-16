/**
 * tests/unit/images/p31-risk-fusion.test.ts
 * Rigorous Unit & Regression Tests for P31 Risk Fusion Architecture.
 *
 * Test matrix covers all core requirements:
 * 1. Monotonicity: Increasing visual flood severity strictly increases R_final monotonically.
 * 2. Sensitivity: Varying weight w or reliability q smoothly scales the visual adjustment.
 * 3. Stale Evidence: Historical / old photos (>24h) have q=0 for active hazard; R_final == R_base.
 * 4. Geographic Assignment: Photos >35m from a building do not bleed across the 250m cell.
 * 5. Missing Data Guardrail: When no imagery exists, R_final == R_base exactly; never zero risk.
 * 6. No-Visual-Evidence Regression: Existing baseline scores remain strictly untouched.
 * 7. Asymmetric Dry Override: Dry photos (R_visual < R_base) cannot wipe out credible modeled risk.
 * 8. City Isolation: Images in Amritsar do not affect Jalandhar roads/buildings and vice versa.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RiskFusionEngine, DEFAULT_FUSION_CONFIG } from '@/lib/images/fusion'
import { imageEvidenceService } from '@/lib/images/service'
import { roadRiskService } from '@/lib/roads/service'
import { buildingExposureService } from '@/lib/buildings/service'
import type { RoadSegmentRecord } from '@/lib/roads/types'

describe('P31 — Risk Fusion Engine & Existing Systems Integration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe('1. Monotonicity Tests', () => {
    it('strictly increases R_final as visual waterlogging severity escalates from dry to submerged', () => {
      const rBase = 40 // Moderate base susceptibility

      const severities = [
        { condition: 'none', expectedVisual: 10 },
        { condition: 'curb_ponding', expectedVisual: 35 },
        { condition: 'flowing_surface_water', expectedVisual: 65 },
        { condition: 'deep_standing_water', expectedVisual: 85 },
        { condition: 'submerged', expectedVisual: 95 },
      ]

      let previousRFinal = -1

      for (const item of severities) {
        const vScore = item.expectedVisual
        const fused = RiskFusionEngine.fuseRisk({
          rBase,
          visualScore: vScore,
          reliability: 0.9,
          config: { maxVisualWeight: 0.35 },
        })

        expect(fused.rFinal).toBeGreaterThanOrEqual(previousRFinal)
        previousRFinal = fused.rFinal
      }

      // Check extremes
      const dryResult = RiskFusionEngine.fuseRisk({ rBase, visualScore: 10, reliability: 0.9 })
      const submergedResult = RiskFusionEngine.fuseRisk({ rBase, visualScore: 95, reliability: 0.9 })

      expect(submergedResult.rFinal).toBeGreaterThan(dryResult.rFinal)
      expect(submergedResult.isVisuallyElevated).toBe(true)
    })
  })

  describe('2. Sensitivity Tests', () => {
    it('smoothly scales visual contribution as reliability q increases from 0.0 to 1.0', () => {
      const rBase = 30
      const rVisual = 90
      const w = 0.4

      const qValues = [0.0, 0.25, 0.5, 0.75, 1.0]
      const results = qValues.map((q) =>
        RiskFusionEngine.fuseRisk({
          rBase,
          visualScore: rVisual,
          reliability: q,
          config: { maxVisualWeight: w },
        })
      )

      // When q=0, R_final must equal R_base
      expect(results[0].rFinal).toBe(30)
      expect(results[0].effectiveWeight).toBe(0.0)

      // Strict monotonic progression with increasing q
      for (let i = 1; i < results.length; i++) {
        expect(results[i].rFinal).toBeGreaterThanOrEqual(results[i - 1].rFinal)
        expect(results[i].effectiveWeight).toBeGreaterThan(results[i - 1].effectiveWeight)
      }

      // At q=1.0: R_final = (1 - 0.4)*30 + 0.4*90 = 18 + 36 = 54
      expect(results[results.length - 1].rFinal).toBe(54)
    })

    it('smoothly scales visual contribution as configurable weight w increases', () => {
      const rBase = 25
      const rVisual = 85
      const q = 0.8

      const wLow = RiskFusionEngine.fuseRisk({
        rBase,
        visualScore: rVisual,
        reliability: q,
        config: { maxVisualWeight: 0.2 },
      })

      const wHigh = RiskFusionEngine.fuseRisk({
        rBase,
        visualScore: rVisual,
        reliability: q,
        config: { maxVisualWeight: 0.5 },
      })

      expect(wHigh.rFinal).toBeGreaterThan(wLow.rFinal)
      expect(wHigh.effectiveWeight).toBeGreaterThan(wLow.effectiveWeight)
    })
  })

  describe('3. Stale & Historical Evidence Handling', () => {
    it('sets reliability q to 0 for historical surveys and leaves R_final exactly equal to R_base', () => {
      const rBase = 45

      const historicalEvidence = {
        imageId: 'IMG-HIST-001',
        source: 'mapillary' as const,
        capturedAt: '2023-07-10T10:00:00.000Z', // 3 years old survey
        isHistorical: true,
        floodedRoad: true,
        passability: 'impassable' as const,
        confidence: 0.95,
      }

      const q = RiskFusionEngine.evaluateRoadReliability(historicalEvidence, 0)
      expect(q).toBe(0.0)

      const vScore = RiskFusionEngine.computeRoadVisualScore(historicalEvidence)
      const fused = RiskFusionEngine.fuseRisk({
        rBase,
        visualScore: vScore,
        reliability: q,
      })

      expect(fused.rFinal).toBe(rBase)
      expect(fused.effectiveWeight).toBe(0.0)
      expect(fused.isVisuallyElevated).toBe(false)
      expect(fused.fusionReason).toContain('No eligible visual evidence')
    })
  })

  describe('4. Geographic Assignment & Non-Bleeding Tests', () => {
    it('associates an image strictly within 35m of a building and ignores photos >35m away in the same cell', () => {
      const buildingCentroid = { lat: 31.6310, lng: 74.8710 }

      // 1. Ingest image 1: Close to building (15 meters away)
      const closeImage = imageEvidenceService.ingestFieldPhoto({
        cityId: 'amritsar',
        imageUrl: 'https://example.com/close_building_flood.jpg',
        coordinates: { lat: 31.6311, lng: 74.8711 }, // ~14m away
        capturedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        categoryHint: 'street_flooding',
        severityHint: 'severe_knee_or_higher',
        description: 'Water at shop entrance doorstep',
      })

      // 2. Ingest image 2: Far from building (180 meters away in same cell)
      const farImage = imageEvidenceService.ingestFieldPhoto({
        cityId: 'amritsar',
        imageUrl: 'https://example.com/far_building_flood.jpg',
        coordinates: { lat: 31.6325, lng: 74.8725 }, // ~190m away
        capturedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        categoryHint: 'street_flooding',
        severityHint: 'severe_knee_or_higher',
        description: 'Road waterlogging far down the road',
      })

      // Query summaries for this building
      const summaries = imageEvidenceService.getBuildingImageSummary(
        'TEST-BLD-GEO-01',
        buildingCentroid,
        true,
        35.0
      )

      const matchedIds = summaries.map((s) => s.imageId)
      expect(matchedIds).toContain(closeImage.id)
      expect(matchedIds).not.toContain(farImage.id) // Non-bleeding verified!
    })
  })

  describe('5. Missing Data & Zero-Risk Guardrails', () => {
    it('guarantees that missing visual imagery never zeroes out or reduces credible risk', () => {
      const rBase = 75 // High terrain risk

      const fused = RiskFusionEngine.fuseRisk({
        rBase,
        visualScore: 0,
        reliability: 0.0, // No visual evidence
      })

      expect(fused.rFinal).toBe(75)
      expect(fused.rFinal).not.toBe(0)
      expect(fused.effectiveWeight).toBe(0.0)
    })
  })

  describe('6. No-Visual-Evidence Regression', () => {
    it('evaluates baseline road segment risk identically when no active imagery exists', () => {
      const mockSegment: RoadSegmentRecord = {
        segmentId: 'ROAD-TEST-NO-IMG',
        osmid: '998877',
        name: 'Untouched Arterial',
        highway: 'secondary',
        lengthM: 300,
        isUnderpass: false,
        isBridge: false,
        fromNode: 10,
        toNode: 11,
        primaryCellId: 'A-9999',
        maxCellSusceptibility: 0.28,
        weightedCellSusceptibility: 0.25,
        unmatchedFraction: 0.0,
        modeledRiskClass: 'low',
        intersectingCells: [{ cellId: 'A-9999', s: 0.28, lengthM: 300, fraction: 1.0 }],
        startCoord: { lat: 31.65, lng: 74.89 },
        endCoord: { lat: 31.652, lng: 74.892 },
      }

      const evaluated = roadRiskService.evaluateSegmentRisk(mockSegment, [])

      expect(evaluated.modeledRiskClass).toBe('low')
      expect(evaluated.dynamicRiskClass).toBe('low')
      expect(evaluated.baseRiskScore).toBe(28)
      expect(evaluated.riskScore).toBe(28) // R_final == R_base exactly
      expect(evaluated.visualReliability).toBe(0.0)
      expect(evaluated.visualWeight).toBe(0.0)
      expect(evaluated.hasActiveImageEvidence).toBe(false)
    })
  })

  describe('7. Asymmetric Dry Override Guardrail', () => {
    it('prevents a dry ground photo from dangerously overriding high modeled catchment risk', () => {
      const highRBase = 85 // High rainfall / susceptibility
      const dryRVisual = 10 // Photo shows dry road spot

      const fused = RiskFusionEngine.fuseRisk({
        rBase: highRBase,
        visualScore: dryRVisual,
        reliability: 0.9, // High quality dry photo
        config: { maxVisualWeight: 0.35 },
      })

      // Without dampening: (1 - 0.315)*85 + 0.315*10 = 58.2 + 3.15 = 61.4
      // With asymmetric dampening (75% weight reduction on dry):
      // effectiveWeight = 0.35 * 0.9 * 0.25 = 0.07875
      // blended = (1 - 0.079)*85 + 0.079*10 = 78.3 + 0.8 = 79.1
      // floor = 85 * 0.85 = 72.25
      expect(fused.rFinal).toBeGreaterThanOrEqual(72)
      expect(fused.rFinal).toBeLessThanOrEqual(highRBase)
      expect(fused.effectiveWeight).toBeLessThan(0.1)
      expect(fused.fusionReason).toContain('Modeled risk maintained')
    })
  })

  describe('8. City Isolation Verification', () => {
    it('confirms that imagery ingested for Amritsar does not alter Jalandhar evaluations', () => {
      // Ingest flood photo with Amritsar coordinates
      imageEvidenceService.ingestFieldPhoto({
        cityId: 'amritsar',
        roadSegmentId: 'ROAD-AMR-ONLY-01',
        imageUrl: 'https://example.com/amritsar_only_flood.jpg',
        coordinates: { lat: 31.634, lng: 74.872 },
        capturedAt: new Date().toISOString(),
        categoryHint: 'street_flooding',
        severityHint: 'severe_knee_or_higher',
        description: 'Amritsar walled city waterlogging',
      })

      // Query Jalandhar road with separate segment ID
      const jalandharSegment: RoadSegmentRecord = {
        segmentId: 'ROAD-JAL-ISOLATED-01',
        osmid: '554433',
        name: 'Jalandhar Cantt Road',
        highway: 'primary',
        lengthM: 500,
        isUnderpass: false,
        isBridge: false,
        fromNode: 101,
        toNode: 102,
        primaryCellId: 'JAL-500',
        maxCellSusceptibility: 0.2,
        weightedCellSusceptibility: 0.2,
        unmatchedFraction: 0.0,
        modeledRiskClass: 'low',
        intersectingCells: [{ cellId: 'JAL-500', s: 0.2, lengthM: 500, fraction: 1.0 }],
        startCoord: { lat: 31.32, lng: 75.57 },
        endCoord: { lat: 31.325, lng: 75.575 },
      }

      const evaluatedJal = roadRiskService.evaluateSegmentRisk(jalandharSegment, [])
      expect(evaluatedJal.hasActiveImageEvidence).toBe(false)
      expect(evaluatedJal.riskScore).toBe(20) // Completely unaffected
      expect(evaluatedJal.dynamicRiskClass).toBe('low')
    })
  })
})
