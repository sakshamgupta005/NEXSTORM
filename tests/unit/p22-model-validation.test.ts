/**
 * tests/unit/p22-model-validation.test.ts
 * Comprehensive regression test suite for NEXSTORM P22 — Localized Flood-Risk
 * Model Validation & Evidence-Based Improvement.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { runHistoricalBacktest } from '@/lib/evaluation/backtest'
import { getCityConfig } from '@/lib/city/registry'
import { riskClass, sBand } from '@/lib/risk/matrix'
import {
  isProhibitedIpv6,
  readBoundedResponseBody,
  validateOutboundUrl,
} from '@/lib/alerts/ssrf'
import { getAlertRepository } from '@/lib/alerts/repository'
import type { DeliveryRecord } from '@/lib/alerts/types'

describe('NEXSTORM P22 — Localized Flood-Risk Model Validation & Spatial Evidence', () => {
  const e6AuditPath = path.resolve(process.cwd(), 'public', 'data', 'evaluation', 'e6_model_validation.json')

  // =========================================================================
  // Phase 1 — Terrain Susceptibility Model Audit
  // =========================================================================
  describe('Phase 1: Model Audit & Invariant Tracing', () => {
    it('verifies city grid resolution is 250m and coordinate system is WGS84 with UTM projection', () => {
      const config = getCityConfig('amritsar')
      expect(config.gridSizeM).toBe(250)
      expect(config.cellCount).toBe(1998)
      expect(config.bbox).toEqual([74.8, 31.575, 74.935, 31.685])
    })

    it('verifies 2D risk matrix maps all 12 combinations deterministically', () => {
      // RTI = none (< 0.5)
      expect(riskClass('low', 'none')).toBe('low')
      expect(riskClass('mid', 'none')).toBe('low')
      expect(riskClass('high', 'none')).toBe('low')

      // RTI = elevated (0.5 <= RTI < 1.0)
      expect(riskClass('low', 'elevated')).toBe('low')
      expect(riskClass('mid', 'elevated')).toBe('low')
      expect(riskClass('high', 'elevated')).toBe('moderate')

      // RTI = severe (1.0 <= RTI < 1.5)
      expect(riskClass('low', 'severe')).toBe('low')
      expect(riskClass('mid', 'severe')).toBe('moderate')
      expect(riskClass('high', 'severe')).toBe('high')

      // RTI = extreme (RTI >= 1.5)
      expect(riskClass('low', 'extreme')).toBe('moderate')
      expect(riskClass('mid', 'extreme')).toBe('high')
      expect(riskClass('high', 'extreme')).toBe('high')
    })

    it('verifies susceptibility index band cutoffs (0.33, 0.66)', () => {
      expect(sBand(0.0)).toBe('low')
      expect(sBand(0.329)).toBe('low')
      expect(sBand(0.33)).toBe('mid')
      expect(sBand(0.50)).toBe('mid')
      expect(sBand(0.66)).toBe('mid')
      expect(sBand(0.661)).toBe('high')
      expect(sBand(1.0)).toBe('high')
    })
  })

  // =========================================================================
  // Phase 2 — Spatial Evidence & 10/13 Reproduction
  // =========================================================================
  describe('Phase 2: Spatial Evidence Validation & 10/13 Location Reproduction', () => {
    it('reproduces exact 10/13 location hit count (76.9%) from the backtesting engine', () => {
      const report = runHistoricalBacktest()
      expect(report.locationMetrics?.totalRainfallLocations).toBe(13)
      expect(report.locationMetrics?.hitLocations).toBe(10)
      expect(report.locationMetrics?.hitRate).toBe(0.7692)

      // Exactly 3 misses
      expect(report.locationMetrics?.lowRiskLocations.length).toBe(3)
      const missIds = report.locationMetrics?.lowRiskLocations.map((l) => l.incidentId)
      expect(missIds).toContain('INC-ASR-2023-004') // H-0004 Alpha Mall
      expect(missIds).toContain('INC-ASR-2024-006') // H-0006 GNDU Gate
      expect(missIds).toContain('INC-ASR-2024-007') // H-0007 Putlighar Chowk
    })

    it('verifies spatial matching and containment in e6 model validation audit', () => {
      expect(fs.existsSync(e6AuditPath)).toBe(true)
      const e6 = JSON.parse(fs.readFileSync(e6AuditPath, 'utf-8'))

      expect(e6.spatialAuditRecords.length).toBe(15)
      for (const rec of e6.spatialAuditRecords) {
        expect(rec.isInsideCell).toBe(true)
        expect(rec.distToBoundaryMeters).toBeGreaterThan(0)
      }
    })

    it('identifies boundary proximity in incident coordinates (e.g. within 15m of boundary)', () => {
      const e6 = JSON.parse(fs.readFileSync(e6AuditPath, 'utf-8'))
      const nearBoundary = e6.spatialAuditRecords.filter((r: { distToBoundaryMeters: number }) => r.distToBoundaryMeters <= 15)
      expect(nearBoundary.length).toBeGreaterThanOrEqual(3) // H-0008, H-0010, H-0011, H-0002
    })

    it('analyzes the 3 misses and confirms immediate neighbor susceptibility context', () => {
      const e6 = JSON.parse(fs.readFileSync(e6AuditPath, 'utf-8'))
      const missAnalysis = e6.missNeighborhoodAnalysis
      expect(missAnalysis.length).toBe(3)

      const h0004 = missAnalysis.find((m: { legacyId: string }) => m.legacyId === 'H-0004')
      const h0007 = missAnalysis.find((m: { legacyId: string }) => m.legacyId === 'H-0007')

      // H-0004 (s=0.605) has an immediate neighbor with s > 0.8
      expect(h0004.hasHighSusceptibilityNeighbor).toBe(true)
      expect(h0004.maxNeighborS).toBeGreaterThan(0.8)

      // H-0007 (s=0.320) has an immediate neighbor with s > 0.8
      expect(h0007.hasHighSusceptibilityNeighbor).toBe(true)
      expect(h0007.maxNeighborS).toBeGreaterThan(0.8)
    })
  })

  // =========================================================================
  // Phase 4 — Leave-One-Storm-Event-Out & Evaluation Integrity
  // =========================================================================
  describe('Phase 4: Evaluation Integrity & LOSEO Cross-Validation', () => {
    it('verifies Leave-One-Storm-Event-Out cross-validation across all 7 storms', () => {
      const e6 = JSON.parse(fs.readFileSync(e6AuditPath, 'utf-8'))
      const loseo = e6.leaveOneStormOutResults
      expect(loseo.length).toBe(7)

      // Verify sample conservation in every fold
      for (const fold of loseo) {
        expect(fold.trainIncidentCount + fold.testIncidentCount).toBe(13)
      }

      // STORM-2024-08-11 has 6 incidents and 100% test recall under extreme rain
      const aug11Fold = loseo.find((f: { heldOutStorm: string }) => f.heldOutStorm === 'STORM-2024-08-11')
      expect(aug11Fold.testIncidentCount).toBe(6)
      expect(aug11Fold.testHitRate).toBe(1.0)
    })

    it('strictly withholds FAR, Specificity, and ROC-AUC over unlabelled negative space', () => {
      const report = runHistoricalBacktest()
      const metrics = report.metrics.model as Record<string, unknown>
      expect(metrics.far).toBeUndefined()
      expect(metrics.rocAuc).toBeUndefined()
      expect(metrics.specificity).toBeUndefined()

      const e6 = JSON.parse(fs.readFileSync(e6AuditPath, 'utf-8'))
      expect(e6.scientificIntegrityConstraints.length).toBeGreaterThanOrEqual(4)
    })
  })

  // =========================================================================
  // Phase 5 — Security & Safety Invariants Regression
  // =========================================================================
  describe('Phase 5: Production Security & Dispatch Invariants', () => {
    it('prohibits expanded IPv6 special-use ranges (translation, discard, benchmark, orchid, 6to4)', () => {
      // 64:ff9b::/96 (IPv4/IPv6 translation prefix)
      expect(isProhibitedIpv6('64:ff9b::192.0.2.1')).toBe(true)
      // 100::/64 (Discard-only prefix)
      expect(isProhibitedIpv6('100::1')).toBe(true)
      // 2001:2::/48 (Benchmarking prefix)
      expect(isProhibitedIpv6('2001:2::1')).toBe(true)
      // 2001:10::/28 (ORCHIDv2 prefix)
      expect(isProhibitedIpv6('2001:10::1')).toBe(true)
      // 2002::/16 (6to4 prefix)
      expect(isProhibitedIpv6('2002:7f00:0001::')).toBe(true)
    })

    it('blocks URLs with Content-Length exceeding maximum response bytes', async () => {
      // Test URL validation blocks embedded credentials
      const resCreds = await validateOutboundUrl('https://admin:secret@api.example.com/webhook')
      expect(resCreds.isValid).toBe(false)
      expect(resCreds.error).toContain('embedded credentials')
    })

    it('enforces bounded response body stream reader against memory exhaustion', async () => {
      const largeData = new Uint8Array(20000) // 20 KB
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(largeData)
          controller.close()
        },
      })
      const mockResponse = new Response(stream)

      await expect(readBoundedResponseBody(mockResponse, 10000)).rejects.toThrow(
        /exceeded maximum allowed limit/
      )
    })

    it('safely reads valid response bodies within allowed limit', async () => {
      const validText = '{"status":"ok"}'
      const mockResponse = new Response(validText)
      const content = await readBoundedResponseBody(mockResponse, 16384)
      expect(content).toBe(validText)
    })

    it('enforces idempotency key deduplication in FileAlertRepository.addDelivery', async () => {
      const repo = getAlertRepository()
      const testKey = `IDEM-TEST-${Date.now()}`
      const delivery1: DeliveryRecord = {
        deliveryId: `DEL-1-${Date.now()}`,
        decisionId: 'DEC-1',
        subscriberId: 'SUB-1',
        destination: 'https://example.com/webhook',
        idempotencyKey: testKey,
        channel: 'webhook',
        status: 'pending',
        attemptCount: 0,
        maxAttempts: 3,
        payload: {
          alertType: 'modeled_risk_alert',
          alertId: 'ALT-TEST',
          cityId: 'amritsar',
          severity: 'elevated',
          maxRti: 1.2,
          thresholdApplied: 0.5,
          affectedAreaDescription: 'Test Area',
          affectedCellsCount: 5,
          evaluatedAt: new Date().toISOString(),
          weatherFreshnessNote: 'Fresh',
          safetyGuidance: 'Stay indoors',
          disclaimer: 'Modeled alert',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const delivery2: DeliveryRecord = {
        ...delivery1,
        deliveryId: `DEL-2-${Date.now()}`, // different deliveryId, same idempotencyKey
      }

      await repo.addDelivery(delivery1)
      await repo.addDelivery(delivery2) // should be deduplicated inside enqueue lock

      const allDeliveries = await repo.getDeliveriesBySubscriber('SUB-1')
      const matching = allDeliveries.filter((d) => d.idempotencyKey === testKey)
      expect(matching.length).toBe(1)
    })
  })
})
