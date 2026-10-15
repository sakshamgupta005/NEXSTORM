import { describe, expect, it } from 'vitest'
import { binomialCI, brierScore, brierSkillScore, csi, far, frequencyBias, liftAtPercentile, pod, rocAuc, wilsonInterval } from '@/lib/evaluation/metrics'

describe('Pure Evaluation Metrics', () => {
  describe('Contingency Metrics (POD, FAR, CSI, Frequency Bias)', () => {
    it('calculates POD correctly for positive denominators', () => {
      // 6 hits out of 9 total events -> 0.6667
      expect(pod(6, 3)).toBe(0.6667)
      expect(pod(0, 5)).toBe(0.0)
      expect(pod(10, 0)).toBe(1.0)
    })

    it('returns null for mathematically undefined POD (0 hits, 0 misses)', () => {
      expect(pod(0, 0)).toBeNull()
    })

    it('calculates FAR correctly for positive denominators', () => {
      // 2 false alarms out of 8 total forecast events -> 0.25
      expect(far(6, 2)).toBe(0.25)
      expect(far(5, 0)).toBe(0.0)
      expect(far(0, 4)).toBe(1.0)
    })

    it('returns null for mathematically undefined FAR (0 hits, 0 false alarms)', () => {
      expect(far(0, 0)).toBeNull()
    })

    it('calculates CSI correctly for positive denominators', () => {
      // 6 hits / (6 + 2 + 3) = 6 / 11 = 0.5455
      expect(csi(6, 2, 3)).toBe(0.5455)
      expect(csi(0, 2, 3)).toBe(0.0)
      expect(csi(10, 0, 0)).toBe(1.0)
    })

    it('returns null for mathematically undefined CSI (0 hits, 0 false alarms, 0 misses)', () => {
      expect(csi(0, 0, 0)).toBeNull()
    })

    it('calculates Frequency Bias correctly', () => {
      // (6 + 2) / (6 + 3) = 8 / 9 = 0.8889
      expect(frequencyBias(6, 2, 3)).toBe(0.8889)
      expect(frequencyBias(10, 5, 5)).toBe(1.0)
    })

    it('returns null for mathematically undefined Frequency Bias (0 hits, 0 misses)', () => {
      expect(frequencyBias(0, 5, 0)).toBeNull()
      expect(frequencyBias(0, 0, 0)).toBeNull()
    })
  })

  describe('Wilson Score Interval', () => {
    it('matches known hand-computed and statistical values', () => {
      const [low5, high5] = wilsonInterval(5, 10, 0.95)
      expect(low5).toBeCloseTo(0.2366, 3)
      expect(high5).toBeCloseTo(0.7634, 3)

      // Verified E3 summary values: baseline 0/9 -> [0.0, 0.2991]
      const [lowBase, highBase] = wilsonInterval(0, 9, 0.95)
      expect(lowBase).toBe(0.0)
      expect(highBase).toBeCloseTo(0.2991, 3)

      // Verified E3 summary values: model 6/9 -> [0.3542, 0.8794]
      const [lowModel, highModel] = wilsonInterval(6, 9, 0.95)
      expect(lowModel).toBeCloseTo(0.3542, 3)
      expect(highModel).toBeCloseTo(0.8794, 3)
    })

    it('handles edge case n=0 gracefully', () => {
      expect(wilsonInterval(0, 0)).toEqual([0.0, 1.0])
    })
  })

  describe('Clopper-Pearson Exact Binomial CI', () => {
    it('matches known mathematical boundary limits and summary.json figures', () => {
      // 0/10 -> lower = 0, upper = 1 - 0.025^(1/10) ~ 0.3085
      const [low0, high0] = binomialCI(0, 10, 0.95)
      expect(low0).toBe(0.0)
      expect(high0).toBeCloseTo(0.3085, 3)

      // 10/10 -> lower = 0.025^(1/10) ~ 0.6915, upper = 1.0
      const [low10, high10] = binomialCI(10, 10, 0.95)
      expect(low10).toBeCloseTo(0.6915, 3)
      expect(high10).toBe(1.0)

      // Verified E2 summary: 8 hits out of 15 hotspots -> [0.2659, 0.7873]
      const [low8, high8] = binomialCI(8, 15, 0.95)
      expect(low8).toBeCloseTo(0.2659, 3)
      expect(high8).toBeCloseTo(0.7873, 3)
    })

    it('handles edge case n=0 gracefully', () => {
      expect(binomialCI(0, 0)).toEqual([0.0, 1.0])
    })
  })

  describe('ROC-AUC (Mann-Whitney U Formulation)', () => {
    it('computes exact analytical values and edge cases', () => {
      expect(rocAuc([1, 1, 0, 0], [1.0, 0.8, 0.2, 0.0])).toBe(1.0)
      expect(rocAuc([1, 1, 0, 0], [0.1, 0.2, 0.8, 0.9])).toBe(0.0)
      expect(rocAuc([1, 0], [0.5, 0.5])).toBe(0.5)
      expect(rocAuc([1, 1, 0, 0], [0.9, 0.4, 0.6, 0.1])).toBe(0.75)
    })
  })

  describe('Brier Score & Skill Score', () => {
    it('computes probability forecast verification metrics', () => {
      expect(brierScore([1.0, 0.0], [1, 0])).toBe(0.0)
      expect(brierScore([0.5, 0.5], [1, 0])).toBe(0.25)
      expect(brierSkillScore(0.125, 0.25)).toBe(0.5)
      expect(brierSkillScore(0.25, 0.25)).toBe(0.0)
    })
  })

  describe('Lift at Percentile', () => {
    it('computes lift over null spatial expectation', () => {
      const scores = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
      const labels = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1]
      const res = liftAtPercentile(scores, labels, 20)
      expect(res.captured).toBe(2)
      expect(res.totalHotspots).toBe(2)
      expect(res.lift).toBe(5.0)
    })
  })
})
