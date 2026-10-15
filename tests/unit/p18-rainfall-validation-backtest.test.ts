/**
 * tests/unit/p18-rainfall-validation-backtest.test.ts
 * Regression test suite for NEXSTORM P18 — Real Rainfall Validation & Historical Backtesting.
 */

import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { rollingSum, rollingSumWithAntecedent, computeRti } from '@/lib/risk/rti'
import {
  toIstTimestamp,
  toAmritsarDateString,
  normalizeTimestampToIst,
  normalizeOpenMeteoResponse,
} from '@/lib/weather/normalize'
import {
  fetchHistoricalArchive,
  fetchHistoricalForecast,
  loadAmritsarHistoricalArchive,
} from '@/lib/weather/historical'
import { runHistoricalBacktest } from '@/lib/evaluation/backtest'
import { GET as handleBacktestGet } from '@/app/api/evaluation/backtest/route'

describe('P18 — Real Rainfall Validation & Historical Backtesting', () => {
  describe('1. Accumulation Windows & Rolling Sum Boundaries', () => {
    it('computes exact 1h, 3h, 24h, and 72h rolling accumulations', () => {
      // 10-hour synthetic precipitation array
      const rain = [2, 0, 5, 10, 0, 3, 1, 0, 0, 4]

      const sum1 = rollingSum(rain, 1)
      expect(sum1).toEqual([2, 0, 5, 10, 0, 3, 1, 0, 0, 4])

      const sum3 = rollingSum(rain, 3)
      expect(sum3[0]).toBe(2)
      expect(sum3[1]).toBe(2)
      expect(sum3[2]).toBe(7) // 2 + 0 + 5
      expect(sum3[3]).toBe(15) // 0 + 5 + 10
      expect(sum3[4]).toBe(15) // 5 + 10 + 0
      expect(sum3[5]).toBe(13) // 10 + 0 + 3

      const sum5 = rollingSum(rain, 5)
      expect(sum5[4]).toBe(17) // 2 + 0 + 5 + 10 + 0
      expect(sum5[5]).toBe(18) // 0 + 5 + 10 + 0 + 3
    })

    it('handles antecedent prepending without cold-start truncation', () => {
      const antecedent = [10, 20, 30] // 3 preceding hours
      const series = [5, 5, 5]

      const res = rollingSumWithAntecedent(series, 3, antecedent)
      expect(res.sums.length).toBe(3)
      // At index 0: window [20, 30, 5] = 55
      expect(res.sums[0]).toBe(55)
      // At index 1: window [30, 5, 5] = 40
      expect(res.sums[1]).toBe(40)
      // At index 2: window [5, 5, 5] = 15
      expect(res.sums[2]).toBe(15)

      // Since 3 antecedent hours were provided, all 3-hour windows are complete
      expect(res.isComplete).toEqual([true, true, true])
    })

    it('rejects invalid window sizes and negative rainfall values', () => {
      expect(() => rollingSum([1, 2], 0)).toThrow(/positive integer/)
      expect(() => rollingSum([1, -2, 3], 2)).toThrow(/non-negative/)
      expect(() => rollingSum([1, NaN, 3], 2)).toThrow(/non-negative/)
    })
  })

  describe('2. Timezone Alignment (UTC vs. IST)', () => {
    it('converts UTC timestamps (with Z) to exact Amritsar IST (+05:30) timestamps', () => {
      // 2023-07-08 20:00 UTC is 2023-07-09 01:30 IST (+5h 30m)
      const ist = toIstTimestamp('2023-07-08T20:00:00Z')
      expect(ist).toBe('2023-07-09T01:30:00+05:30')
    })

    it('extracts correct Amritsar local calendar date regardless of UTC hour', () => {
      // 8 PM UTC on July 8th is July 9th in Amritsar
      const date1 = toAmritsarDateString('2023-07-08T20:00:00Z')
      expect(date1).toBe('2023-07-09')

      // 10 AM UTC on July 8th is still July 8th in Amritsar (3:30 PM)
      const date2 = toAmritsarDateString('2023-07-08T10:00:00Z')
      expect(date2).toBe('2023-07-08')
    })

    it('preserves existing contract of normalizeTimestampToIst for backward compatibility', () => {
      expect(normalizeTimestampToIst('2026-10-14T00:00', 19800)).toBe('2026-10-14T00:00:00+05:30')
      expect(normalizeTimestampToIst('2026-10-14T00:00:00Z')).toBe('2026-10-14T00:00:00Z')
    })
  })

  describe('3. Missing Rainfall Data & Degradation Policy', () => {
    it('tracks missing forecast intervals and annotates dataQuality without silent imputation', () => {
      const rawPayload = {
        latitude: 31.63,
        longitude: 74.87,
        utc_offset_seconds: 19800,
        hourly: {
          time: ['2026-10-14T00:00', '2026-10-14T01:00', '2026-10-14T02:00', '2026-10-14T03:00'],
          precipitation: [2.5, null, 1.0, null],
        },
      }

      const { series, nullCount } = normalizeOpenMeteoResponse(rawPayload, {
        cityId: 'amritsar',
        model: 'test_model',
        gridKm: 9,
        source: 'Test Source',
      })

      expect(nullCount).toBe(2)
      expect(series.dataQuality).toBeDefined()
      expect(series.dataQuality?.nullCount).toBe(2)
      expect(series.dataQuality?.missingIndices).toEqual([1, 3])
      expect(series.dataQuality?.completenessRatio).toBe(0.5)
      expect(series.dataQuality?.isDegraded).toBe(true)
      expect(series.dataQuality?.policy).toBe('imputed_zero_marked_degraded')

      // Provenance warning must explicitly state missing intervals
      expect(series.provenance.note).toContain('DATA QUALITY WARNING: 2 missing')
    })

    it('flags dataQuality as complete and non-degraded when all intervals are present', () => {
      const rawPayload = {
        latitude: 31.63,
        longitude: 74.87,
        utc_offset_seconds: 19800,
        hourly: {
          time: ['2026-10-14T00:00', '2026-10-14T01:00'],
          precipitation: [0.0, 1.2],
        },
      }

      const { series, nullCount } = normalizeOpenMeteoResponse(rawPayload, {
        cityId: 'amritsar',
        model: 'test_model',
        gridKm: 9,
        source: 'Test Source',
      })

      expect(nullCount).toBe(0)
      expect(series.dataQuality?.isDegraded).toBe(false)
      expect(series.dataQuality?.completenessRatio).toBe(1.0)
      expect(series.dataQuality?.policy).toBe('complete_unmodified')
    })
  })

  describe('4. Historical Query Validation & Date Boundaries', () => {
    it('rejects inverted date ranges (startDate > endDate) with degraded status', async () => {
      const res = await fetchHistoricalArchive({
        cityId: 'amritsar',
        startDate: '2024-09-01',
        endDate: '2024-08-01', // Inverted
      })

      expect(res.status).toBe('degraded')
      expect(res.error).toContain('is after endDate')
      expect(res.provenance.note).toContain('DEGRADED')
    })

    it('rejects invalid date format with degraded status', async () => {
      const res = await fetchHistoricalForecast({
        cityId: 'amritsar',
        startDate: 'invalid-date',
        endDate: '2024-08-01',
      })

      expect(res.status).toBe('degraded')
      expect(res.error).toContain('Invalid startDate format')
    })

    it('loads local ERA5-Land reanalysis archive slice for Amritsar without network dependency', () => {
      const res = loadAmritsarHistoricalArchive({
        startDate: '2024-08-01',
        endDate: '2024-08-02',
        warmupHours: 24,
      })

      expect(res.status).toBe('ok')
      expect(res.data).toBeDefined()
      expect(res.data?.cityId).toBe('amritsar')
      expect(res.data?.model).toContain('ERA5-Land')
      // Sliced hours: 24h warmup + 48h for 2 days = 72 hours
      expect(res.data?.hours.length).toBeGreaterThanOrEqual(48)
      expect(res.data?.hours[0]).toContain('+05:30')
    })
  })

  describe('5. Chronological Backtesting & No Future Leakage', () => {
    it('produces bit-exact identical RTI scores at hour t regardless of future series length', () => {
      const thresholds = { T1h: 3.5, T3h: 7.0, T24h: 25.0, T72h: 50.0, provisional: false }
      const shortRain = [2, 4, 1, 0, 8, 3]
      const extendedRain = [2, 4, 1, 0, 8, 3, 100, 200, 300, 400] // extreme future rain

      // Evaluate at index t=4 (rain = 8)
      const rtiShort = computeRti(shortRain, 4, thresholds)
      const rtiExtended = computeRti(extendedRain, 4, thresholds)

      // The future extreme downpour must have zero effect on hour t=4
      expect(rtiShort).toBe(rtiExtended)
    })

    it('runs historical backtest across 2023-2024 monsoons and evaluates against Tribune incidents', () => {
      const report = runHistoricalBacktest({
        cityId: 'amritsar',
        startDate: '2023-06-01',
        endDate: '2024-09-30',
        warmupHours: 72,
      })

      expect(report.cityId).toBe('amritsar')
      expect(report.sampleCounts.reportedIncidentDays).toBe(9)
      expect(report.sampleCounts.distinctIncidents).toBe(15)

      // Model alert evaluation: POD must be strictly positive
      expect(report.metrics.model.hits).toBeGreaterThanOrEqual(6)
      expect(report.metrics.model.pod).toBeGreaterThanOrEqual(0.66)
      expect(report.metrics.model.wilson95CI[0]).toBeGreaterThan(0.3)

      // Baseline IMD evaluation: 64.5mm threshold captures very few events
      expect(report.metrics.baseline.hits).toBeLessThanOrEqual(2)
      expect(report.metrics.baseline.pod).toBeLessThanOrEqual(0.25)

      // Limitations and non-claims are truthfully documented
      expect(report.scientificNonClaims).toContain('NEXSTORM does not predict flood depth in centimeters.')
      expect(report.limitations.some((l) => l.includes('Reporting bias'))).toBe(true)
    })
  })

  describe('6. GET /api/evaluation/backtest API Endpoint', () => {
    it('returns HTTP 200 with backtest report and provenance metadata', async () => {
      const req = new NextRequest('http://localhost:3000/api/evaluation/backtest?cityId=amritsar&season=2024')
      const res = await handleBacktestGet(req)

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.cityId).toBe('amritsar')
      expect(json.data.evaluationSpan.startDate).toBe('2024-06-01')
      expect(json.data.metrics.model.hits).toBeDefined()
      expect(json.data.events.length).toBeGreaterThan(0)
    })

    it('returns HTTP 400 for unknown city', async () => {
      const req = new NextRequest('http://localhost:3000/api/evaluation/backtest?cityId=unknown_city')
      const res = await handleBacktestGet(req)

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('UNKNOWN_CITY')
    })
  })
})
