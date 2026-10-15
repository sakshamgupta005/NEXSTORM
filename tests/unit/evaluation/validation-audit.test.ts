import { describe, expect, it } from 'vitest'
import { brierScore, brierSkillScore, liftAtPercentile, rocAuc } from '@/lib/evaluation/metrics'
import { runScientificValidationAudit } from '@/lib/evaluation/validation'
import { normalizeOpenMeteoResponse } from '@/lib/weather/normalize'
import { loadSnapshot, saveSnapshot } from '@/lib/weather/snapshots'
import fs from 'node:fs'
import path from 'node:path'

describe('P7 Scientific Validation, Calibration Audit & Data Reliability', () => {
  describe('Mathematical Properties of New Evaluation Metrics', () => {
    it('computes exact ROC-AUC for perfect, inverted, and partial separation', () => {
      // Perfect separation -> AUC = 1.0
      expect(rocAuc([1, 1, 0, 0], [0.9, 0.8, 0.2, 0.1])).toBe(1.0)

      // Completely inverted separation -> AUC = 0.0
      expect(rocAuc([1, 1, 0, 0], [0.1, 0.2, 0.8, 0.9])).toBe(0.0)

      // Identical scores -> AUC = 0.5 (random guess)
      expect(rocAuc([1, 0], [0.5, 0.5])).toBe(0.5)

      // Partial separation with known Mann-Whitney U
      // pos: [0.9, 0.4], neg: [0.6, 0.1]
      // 0.9 > 0.6 (1), 0.9 > 0.1 (1)
      // 0.4 < 0.6 (0), 0.4 > 0.1 (1)
      // U = 3 / (2 * 2) = 0.75
      expect(rocAuc([1, 1, 0, 0], [0.9, 0.4, 0.6, 0.1])).toBe(0.75)
    })

    it('rejects mismatched array lengths or non-binary ground truth for ROC-AUC', () => {
      expect(() => rocAuc([1, 0], [0.5])).toThrow(/Array lengths must match/)
      expect(() => rocAuc([1, 2], [0.5, 0.6])).toThrow(/yTrue values must be 0 or 1/)
      expect(() => rocAuc([1, 0], [NaN, 0.5])).toThrow(/Invalid score/)
    })

    it('computes Brier score and Brier skill score accurately', () => {
      // Perfect probabilistic prediction: BS = 0.0
      expect(brierScore([1.0, 0.0], [1, 0])).toBe(0.0)

      // Complete inversion: BS = 1.0
      expect(brierScore([0.0, 1.0], [1, 0])).toBe(1.0)

      // Fixed 0.5 guess: BS = ((0.5 - 1)^2 + (0.5 - 0)^2)/2 = 0.25
      expect(brierScore([0.5, 0.5], [1, 0])).toBe(0.25)

      // Brier skill score over reference baseline: 1 - (BS / BS_ref)
      expect(brierSkillScore(0.125, 0.25)).toBe(0.5)
      expect(brierSkillScore(0.25, 0.25)).toBe(0.0)
      expect(brierSkillScore(0.30, 0.25)).toBe(-0.2)
      expect(brierSkillScore(0.1, 0.0)).toBeNull()
    })

    it('computes lift at percentile cutoffs over spatial null', () => {
      // 10 cells, 2 hotspots. Hotspots score 0.9 and 0.8 (top 20%).
      const scores = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9]
      const labels = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1]

      const top20 = liftAtPercentile(scores, labels, 20)
      expect(top20.captured).toBe(2)
      expect(top20.totalHotspots).toBe(2)
      expect(top20.captureRate).toBe(1.0)
      expect(top20.lift).toBe(5.0) // 1.0 / 0.2 = 5.0x lift
    })
  })

  describe('runScientificValidationAudit against Real Artifacts', () => {
    it('evaluates Amritsar pilot with frozen config hash and honest sample counts', () => {
      const report = runScientificValidationAudit('amritsar')

      expect(report.cityId).toBe('amritsar')
      expect(report.configHash).toBe('74f463261a4c15cdc850b8d5be687bee4e59fd2950b7b93395449f3dacefcd49')
      expect(report.sampleCounts.totalCityCells).toBe(1998)
      expect(report.sampleCounts.distinctHotspotCells).toBe(15)
      expect(report.sampleCounts.eventCalendarDays).toBe(9)
      expect(report.sampleCounts.seasonsEvaluated).toBe(10)

      // Verified E2 figures
      expect(report.hotspotRecovery.top20PercentHits).toBe(8)
      expect(report.hotspotRecovery.observedHitShare).toBe(0.5333)
      expect(report.hotspotRecovery.expectedHitShareUnderNull).toBe(0.20)
      expect(report.hotspotRecovery.binomialExact95CI).toEqual([0.2659, 0.7873])
      expect(report.hotspotRecovery.medianPercentile).toBeCloseTo(81.93, 1)

      // Baseline comparison
      expect(report.baselineComparison.length).toBe(4)
      const randomBase = report.baselineComparison.find((b) => b.baselineName.includes('Random'))
      const sScore = report.baselineComparison.find((b) => b.baselineName.includes('Susceptibility'))
      const builtUp = report.baselineComparison.find((b) => b.baselineName.includes('Built-Up'))

      expect(randomBase?.rocAuc).toBe(0.5000)
      expect(sScore?.rocAuc).toBe(0.5609)
      expect(builtUp?.rocAuc).toBe(0.8658)
      expect(builtUp?.isAdopted).toBe(false) // rejected due to news reporting bias!

      // Reporting bias documentation
      expect(report.reportingBiasFindings.primaryPublication).toContain('The Tribune India')
      expect(report.reportingBiasFindings.biasDiagnosis).toContain('journalist reporting location bias')

      // Temporal split consistency (2023 vs 2024)
      expect(report.temporalConsistency.length).toBe(2)
      expect(report.temporalConsistency[0].season).toBe('Monsoon 2023')
      expect(report.temporalConsistency[0].top20PercentHits).toBe(4)
      expect(report.temporalConsistency[1].season).toBe('Monsoon 2024')
      expect(report.temporalConsistency[1].top20PercentHits).toBe(4)

      // Alert burden trade-off
      expect(report.alertBurdenAnalysis.modelAlertDaysPerSeason).toBe(45.0)
      expect(report.alertBurdenAnalysis.monsoonDaysPerSeason).toBe(122)
      expect(report.alertBurdenAnalysis.tradeoffSummary).toContain('high false alarm burden')
    })
  })

  describe('Data Reliability & Provenance Failure Mode Guards', () => {
    it('appends explicit DATA QUALITY WARNING to provenance when missing forecast hours are imputed', () => {
      const payloadWithMissingHours = {
        latitude: 31.63,
        longitude: 74.87,
        utc_offset_seconds: 19800,
        hourly: {
          time: ['2026-10-14T00:00', '2026-10-14T01:00', '2026-10-14T02:00'],
          precipitation: [2.5, null, 0.8],
        },
      }

      const { series, nullCount } = normalizeOpenMeteoResponse(payloadWithMissingHours, {
        cityId: 'amritsar',
        model: 'open_meteo_deterministic',
        gridKm: 9,
        source: 'Open-Meteo Deterministic',
      })

      expect(nullCount).toBe(1)
      expect(series.deterministic).toEqual([2.5, 0, 0.8])
      expect(series.provenance.note).toContain('DATA QUALITY WARNING: 1 missing forecast interval(s) imputed as 0 mm')
    })

    it('rejects snapshots with timestamps in the future from clock skew or file tampering', async () => {
      const tempCityId = 'test_future_clock'
      const futureDate = new Date(Date.now() + 3600000).toISOString() // 1 hour in the future

      const testSeries = {
        cityId: tempCityId,
        issueTime: futureDate,
        hours: [futureDate],
        deterministic: [0.0],
        model: 'test',
        gridKm: 25,
        provenance: {
          kind: 'live' as const,
          source: 'test',
          fetchedAt: futureDate,
        },
      }

      await saveSnapshot(tempCityId, 'test', testSeries)
      // Manually tamper savedAt to future
      const snapshotPath = path.resolve(process.cwd(), 'public', 'data', 'snapshots', `${tempCityId}-rainfall.json`)
      const raw = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'))
      raw.savedAt = futureDate
      fs.writeFileSync(snapshotPath, JSON.stringify(raw), 'utf-8')

      const loaded = await loadSnapshot(tempCityId, 21600)
      expect(loaded).toBeNull() // strictly rejected!

      // Cleanup
      if (fs.existsSync(snapshotPath)) {
        fs.unlinkSync(snapshotPath)
      }
    })
  })
})
