/**
 * tests/unit/p19-event-evidence-evaluation.test.ts
 * Comprehensive regression test suite for NEXSTORM P19 — Historical Ground Truth,
 * Event Verification & Evaluation Integrity.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { loadHistoricalIncidents, runHistoricalBacktest } from '@/lib/evaluation/backtest'
import { getCitySusceptibility, getCityConfig } from '@/lib/city/registry'

describe('P19 — Historical Ground Truth, Event Verification & Evaluation Integrity', () => {
  const inventoryPath = path.resolve(
    process.cwd(),
    'public',
    'data',
    'cities',
    'amritsar',
    'incidents_inventory.json'
  )

  describe('1. Incident Inventory Schema & Provenance', () => {
    it('verifies all 15 records in incidents_inventory.json conform to schema', () => {
      expect(fs.existsSync(inventoryPath)).toBe(true)
      const raw = fs.readFileSync(inventoryPath, 'utf-8')
      const incidents = JSON.parse(raw)

      expect(incidents.length).toBe(15)

      const requiredKeys = [
        'incidentId',
        'legacyId',
        'stormEventId',
        'name',
        'locality',
        'cellId',
        'lat',
        'lon',
        'precision',
        'geocodingMethod',
        'source',
        'sourceUrl',
        'publishedAt',
        'articleDate',
        'estimatedEventStart',
        'estimatedEventEnd',
        'timeConfidence',
        'category',
        'reportedImpact',
        'evidenceExcerpt',
        'verificationStatus',
        'verificationMethod',
        'sourceIndependence',
        'isRainfallDriven',
        'inclusionDecision',
        'inclusionReason',
      ]

      for (const inc of incidents) {
        for (const k of requiredKeys) {
          expect(inc, `Record ${inc.incidentId} must have property ${k}`).toHaveProperty(k)
        }
      }
    })

    it('verifies incident coordinates lie strictly within Amritsar city bbox', () => {
      const config = getCityConfig('amritsar')
      const [minLon, minLat, maxLon, maxLat] = config.bbox
      const incidents = loadHistoricalIncidents('amritsar')

      expect(incidents.length).toBe(15)
      for (const inc of incidents) {
        expect(inc.lat).toBeGreaterThanOrEqual(minLat)
        expect(inc.lat).toBeLessThanOrEqual(maxLat)
        expect(inc.lon).toBeGreaterThanOrEqual(minLon)
        expect(inc.lon).toBeLessThanOrEqual(maxLon)
      }
    })

    it('verifies incident cell IDs exist in the canonical susceptibility grid', () => {
      const susceptibility = getCitySusceptibility('amritsar')
      const knownCells = new Set(susceptibility.features.map((f) => f.properties.id))
      const incidents = loadHistoricalIncidents('amritsar')

      for (const inc of incidents) {
        expect(knownCells.has(inc.cellId)).toBe(true)
      }
    })
  })

  describe('2. Non-Rainfall Incident Exclusion & Scientific Integrity', () => {
    it('identifies and excludes H-0003 canal embankment breach from rainfall validation', () => {
      const incidents = loadHistoricalIncidents('amritsar')
      const h0003 = incidents.find((i) => i.id === 'H-0003' || i.incidentId === 'INC-ASR-2023-003')

      expect(h0003).toBeDefined()
      expect(h0003?.isRainfallDriven).toBe(false)
      expect(h0003?.inclusionDecision).toBe('excluded')
      expect(h0003?.verificationStatus).toBe('excluded_with_reason')
      expect(h0003?.inclusionReason).toContain('canal')
    })

    it('identifies and excludes H-0005 chronic stagnation (0.0mm rain) from rainfall validation', () => {
      const incidents = loadHistoricalIncidents('amritsar')
      const h0005 = incidents.find((i) => i.id === 'H-0005' || i.incidentId === 'INC-ASR-2023-005')

      expect(h0005).toBeDefined()
      expect(h0005?.isRainfallDriven).toBe(false)
      expect(h0005?.inclusionDecision).toBe('excluded')
      expect(h0005?.verificationStatus).toBe('excluded_with_reason')
      expect(h0005?.inclusionReason).toContain('0.0 mm')
    })
  })

  describe('3. Storm Grouping & Deduplication', () => {
    it('clusters the 15 records into exactly 7 genuine rainfall storms and 2 excluded events', () => {
      const report = runHistoricalBacktest()

      expect(report.sampleCounts.distinctIncidents).toBe(15)
      expect(report.sampleCounts.distinctRainfallStorms).toBe(7)
      expect(report.sampleCounts.excludedIncidents).toBe(2)
      expect(report.stormEvents?.length).toBe(7)
      expect(report.excludedEvents?.length).toBe(2)
    })

    it('clusters all 6 records from 2024-08-11 into a single storm event', () => {
      const report = runHistoricalBacktest()
      const stormAug11 = report.stormEvents?.find((s) => s.stormEventId === 'STORM-2024-08-11')

      expect(stormAug11).toBeDefined()
      expect(stormAug11?.incidentCount).toBe(6)
      expect(stormAug11?.locations.length).toBe(6)
      expect(stormAug11?.locations).toContain('Batala Road Celebration Mall Stretch')
      expect(stormAug11?.locations).toContain('Taylor Road Civil Lines')
    })

    it('identifies shared-article provenance between H-0013 and H-0015', () => {
      const raw = JSON.parse(fs.readFileSync(inventoryPath, 'utf-8')) as Array<{
        legacyId: string
        sourceUrl: string
        sourceIndependence: string
      }>
      const h13 = raw.find((r) => r.legacyId === 'H-0013')
      const h15 = raw.find((r) => r.legacyId === 'H-0015')

      expect(h13?.sourceUrl).toBe(h15?.sourceUrl)
      expect(h13?.sourceIndependence).toContain('shares_source_url_with_H0015')
    })
  })

  describe('4. Baseline Audit & Defensible Nomenclature', () => {
    it('verifies baseline rule is accurately labeled as ERA5 reanalysis rather than direct IMD station', () => {
      const report = runHistoricalBacktest()

      expect(report.metrics.baseline.rule).toContain('ERA5 Reanalysis')
      expect(report.metrics.baseline.rule).toContain('IMD Heavy Rainfall Threshold')
      expect(report.provenance.rainfallModel).toContain('ERA5-Land')

      // Scientific non-claims explicitly clarify reanalysis vs in-situ gauge
      expect(
        report.scientificNonClaims.some((c) =>
          c.includes('baseline comparison uses ERA5-Land gridded reanalysis')
        )
      ).toBe(true)
    })

    it('verifies baseline 64.5mm threshold captures exactly 1 event (2024-08-01)', () => {
      const report = runHistoricalBacktest()
      expect(report.metrics.baseline.hits).toBe(1)
      expect(report.metrics.baseline.totalAlertDays).toBe(1)

      const hitStorm = report.stormEvents?.find((s) => s.baselineDetected)
      expect(hitStorm?.date).toBe('2024-08-01')
    })
  })

  describe('5. Separation of Storm-Level and Location-Level Performance', () => {
    it('evaluates storm-level detection across 7 genuine storms (100% POD at RTI >= 0.5)', () => {
      const report = runHistoricalBacktest()

      const stormHits = report.stormEvents?.filter((s) => s.modelDetected).length
      expect(stormHits).toBe(7)
      expect(report.stormEvents?.length).toBe(7)
    })

    it('evaluates cell-level location risk across 13 rainfall incidents (10/13 = 76.9% hit rate)', () => {
      const report = runHistoricalBacktest()

      expect(report.locationMetrics).toBeDefined()
      expect(report.locationMetrics?.totalRainfallLocations).toBe(13)
      expect(report.locationMetrics?.hitLocations).toBe(10)
      expect(report.locationMetrics?.hitRate).toBe(0.7692)

      // Identifies the 3 low-risk locations where moderate rain did not overcome low/mid susceptibility
      const lowRiskIds = report.locationMetrics?.lowRiskLocations.map((l) => l.incidentId)
      expect(lowRiskIds).toContain('INC-ASR-2023-004') // GT Road near Alpha Mall
      expect(lowRiskIds).toContain('INC-ASR-2024-006') // GNDU Main Gate
      expect(lowRiskIds).toContain('INC-ASR-2024-007') // Putlighar Main Chowk
    })
  })

  describe('6. RTI Threshold Sensitivity Analysis', () => {
    it('computes sensitivity across RTI thresholds [0.5, 0.75, 1.0, 1.25, 1.5]', () => {
      const report = runHistoricalBacktest()

      expect(report.thresholdSensitivity).toBeDefined()
      expect(report.thresholdSensitivity?.length).toBe(5)

      const s05 = report.thresholdSensitivity?.find((s) => s.thresholdRti === 0.5)
      const s075 = report.thresholdSensitivity?.find((s) => s.thresholdRti === 0.75)
      const s10 = report.thresholdSensitivity?.find((s) => s.thresholdRti === 1.0)
      const s15 = report.thresholdSensitivity?.find((s) => s.thresholdRti === 1.5)

      // RTI 0.5: 7 hits, 65.5 alert-days/season
      expect(s05?.hits).toBe(7)
      expect(s05?.pod).toBe(1.0)
      expect(s05?.alertDaysPerSeason).toBe(65.5)

      // RTI 0.75: 6 hits, 47.5 alert-days/season
      expect(s075?.hits).toBe(6)
      expect(s075?.pod).toBe(0.8571)
      expect(s075?.alertDaysPerSeason).toBe(47.5)

      // RTI 1.0: 4 hits, 34.5 alert-days/season
      expect(s10?.hits).toBe(4)
      expect(s10?.pod).toBe(0.5714)
      expect(s10?.alertDaysPerSeason).toBe(34.5)

      // RTI 1.5: 4 hits, 24.5 alert-days/season
      expect(s15?.hits).toBe(4)
      expect(s15?.pod).toBe(0.5714)
      expect(s15?.alertDaysPerSeason).toBe(24.5)
    })
  })

  describe('7. Negative Space Handling & Lead Time Honesty', () => {
    it('strictly withholds false alarm rate (FAR) and ROC-AUC over unlabelled dates/cells', () => {
      const report = runHistoricalBacktest()

      // Metrics object must NOT contain FAR or ROC-AUC claims
      const modelMetrics = report.metrics.model as Record<string, unknown>
      expect(modelMetrics.far).toBeUndefined()
      expect(modelMetrics.rocAuc).toBeUndefined()
      expect(modelMetrics.specificity).toBeUndefined()

      // Scientific non-claims must document this withholding
      expect(
        report.scientificNonClaims.some((c) =>
          c.includes('False Alarm Rate (FAR), Specificity, and ROC-AUC cannot be scientifically computed')
        )
      ).toBe(true)
    })

    it('documents that retrospective reanalysis provides situational awareness, not predictive lead time', () => {
      const report = runHistoricalBacktest()

      expect(
        report.scientificNonClaims.some((c) =>
          c.includes('Historical evaluation does not provide predictive lead time')
        )
      ).toBe(true)
    })
  })
})
