import { describe, it, expect } from 'vitest'
import { classDistribution, displayedClass, confidenceOf } from '@/lib/risk/distribution'
import type { RiskClass } from '@/lib/risk/types'

describe('Risk Distribution & Ensemble Confidence', () => {
  describe('classDistribution()', () => {
    it('returns zeroes for empty input', () => {
      expect(classDistribution([])).toEqual({ low: 0, moderate: 0, high: 0 })
    })

    it('correctly normalizes distribution fractions summing to 1', () => {
      const classes: RiskClass[] = ['low', 'low', 'moderate', 'high']
      const dist = classDistribution(classes)
      expect(dist.low).toBe(0.5)
      expect(dist.moderate).toBe(0.25)
      expect(dist.high).toBe(0.25)
      expect(dist.low + dist.moderate + dist.high).toBeCloseTo(1.0, 3)
    })
  })

  describe('displayedClass()', () => {
    it('returns high if high fraction >= threshold', () => {
      expect(displayedClass({ low: 0.5, moderate: 0.1, high: 0.4 }, 0.4)).toBe('high')
      expect(displayedClass({ low: 0.2, moderate: 0.3, high: 0.5 }, 0.4)).toBe('high')
    })

    it('returns moderate if high + moderate >= threshold but high < threshold', () => {
      expect(displayedClass({ low: 0.5, moderate: 0.3, high: 0.2 }, 0.4)).toBe('moderate')
    })

    it('returns low if sum of moderate and high < threshold', () => {
      expect(displayedClass({ low: 0.7, moderate: 0.2, high: 0.1 }, 0.4)).toBe('low')
    })
  })

  describe('confidenceOf()', () => {
    it('returns unavailable for single scenario (< 2 members)', () => {
      expect(confidenceOf(['high'], 'high')).toBe('unavailable')
      expect(confidenceOf([], 'low')).toBe('unavailable')
    })

    it('returns high when agreement >= 80%', () => {
      const classes: RiskClass[] = ['high', 'high', 'high', 'high', 'low']
      expect(confidenceOf(classes, 'high')).toBe('high') // 4/5 = 80%
    })

    it('returns medium when agreement >= 50% and < 80%', () => {
      const classes: RiskClass[] = ['moderate', 'moderate', 'high', 'low']
      expect(confidenceOf(classes, 'moderate')).toBe('medium') // 2/4 = 50%
    })

    it('returns low when agreement < 50%', () => {
      const classes: RiskClass[] = ['low', 'moderate', 'high']
      expect(confidenceOf(classes, 'high')).toBe('low') // 1/3 = 33.3%
    })
  })
})
