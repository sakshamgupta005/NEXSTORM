import { describe, it, expect } from 'vitest'
import { rollingSum, computeRti, rtiBand } from '@/lib/risk/rti'
import type { RtiThresholds } from '@/lib/risk/types'

describe('RTI Engine & Rolling Sums', () => {
  const dummyThresholds: RtiThresholds = {
    T1h: 25.0,
    T3h: 50.0,
    T24h: 64.5,
    T72h: 120.0,
    provisional: true,
  }

  describe('rollingSum()', () => {
    it('returns empty array for empty series', () => {
      expect(rollingSum([], 3)).toEqual([])
    })

    it('sums available preceding values when index is smaller than window', () => {
      const series = [10, 20, 30, 40]
      const sums = rollingSum(series, 3)
      // index 0: 10
      // index 1: 10 + 20 = 30
      // index 2: 10 + 20 + 30 = 60
      // index 3: 20 + 30 + 40 = 90
      expect(sums).toEqual([10, 30, 60, 90])
    })

    it('accurately computes window of 1', () => {
      const series = [5, 15, 25]
      expect(rollingSum(series, 1)).toEqual([5, 15, 25])
    })

    it('rejects invalid window sizes', () => {
      expect(() => rollingSum([1, 2], 0)).toThrow(/positive integer/)
      expect(() => rollingSum([1, 2], -2)).toThrow(/positive integer/)
      expect(() => rollingSum([1, 2], 2.5)).toThrow(/positive integer/)
    })

    it('rejects negative or non-finite rainfall values', () => {
      expect(() => rollingSum([10, -5, 20], 2)).toThrow(/finite non-negative/)
      expect(() => rollingSum([10, NaN, 20], 2)).toThrow(/finite non-negative/)
      expect(() => rollingSum([10, Infinity, 20], 2)).toThrow(/finite non-negative/)
    })
  })

  describe('computeRti()', () => {
    it('computes maximum ratio among 1h, 3h, 24h, and 72h windows', () => {
      // 24-hour event of 0 rain except at hour 5 with 50mm
      const series = new Array(48).fill(0)
      series[5] = 50 // P1h=50, P3h=50, P24h=50, P72h=50

      // at hour 5:
      // P1h / T1h = 50 / 25 = 2.0
      // P3h / T3h = 50 / 50 = 1.0
      // P24h / T24h = 50 / 64.5 = 0.775
      // (P72h + 0) / T72h = 50 / 120 = 0.416
      // max should be 2.0
      const rti = computeRti(series, 5, dummyThresholds, 0)
      expect(rti).toBeCloseTo(2.0, 3)
    })

    it('incorporates antecedent 72h rainfall into P72h', () => {
      const series = new Array(48).fill(0)
      // antecedent is 120mm, series is 0mm
      // (0 + 120) / 120 = 1.0
      const rti = computeRti(series, 0, dummyThresholds, 120)
      expect(rti).toBeCloseTo(1.0, 3)
    })

    it('throws on out-of-bounds hourIndex', () => {
      const series = [10, 20]
      expect(() => computeRti(series, -1, dummyThresholds)).toThrow(/out of bounds/)
      expect(() => computeRti(series, 5, dummyThresholds)).toThrow(/out of bounds/)
    })

    it('throws on invalid thresholds or negative antecedent', () => {
      const series = [10, 20]
      const invalidThresholds = { ...dummyThresholds, T1h: 0 }
      expect(() => computeRti(series, 0, invalidThresholds)).toThrow(/positive/)
      expect(() => computeRti(series, 0, dummyThresholds, -10)).toThrow(/non-negative/)
    })
  })

  describe('rtiBand()', () => {
    it('correctly categorizes boundary cases', () => {
      expect(rtiBand(0.0)).toBe('none')
      expect(rtiBand(0.499)).toBe('none')
      expect(rtiBand(0.5)).toBe('elevated')
      expect(rtiBand(0.999)).toBe('elevated')
      expect(rtiBand(1.0)).toBe('severe')
      expect(rtiBand(1.499)).toBe('severe')
      expect(rtiBand(1.5)).toBe('extreme')
      expect(rtiBand(3.5)).toBe('extreme')
    })

    it('rejects invalid RTI values', () => {
      expect(() => rtiBand(-0.1)).toThrow(/non-negative/)
      expect(() => rtiBand(NaN)).toThrow(/non-negative/)
    })
  })
})
