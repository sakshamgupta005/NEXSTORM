import { describe, it, expect } from 'vitest'
import { sBand, riskClass } from '@/lib/risk/matrix'
import type { RtiBand, SBand } from '@/lib/risk/types'

describe('Susceptibility & 12-Cell Risk Matrix', () => {
  describe('sBand()', () => {
    it('accurately categorizes susceptibility thresholds', () => {
      expect(sBand(0.0)).toBe('low')
      expect(sBand(0.329)).toBe('low')
      expect(sBand(0.33)).toBe('mid')
      expect(sBand(0.66)).toBe('mid')
      expect(sBand(0.661)).toBe('high')
      expect(sBand(1.0)).toBe('high')
    })

    it('rejects values outside [0, 1]', () => {
      expect(() => sBand(-0.01)).toThrow(/between 0 and 1/)
      expect(() => sBand(1.05)).toThrow(/between 0 and 1/)
      expect(() => sBand(NaN)).toThrow(/between 0 and 1/)
    })
  })

  describe('riskClass() — 12 Matrix Combinations', () => {
    const table: Array<[RtiBand, SBand, string]> = [
      // none band -> all low
      ['none', 'low', 'low'],
      ['none', 'mid', 'low'],
      ['none', 'high', 'low'],

      // elevated band
      ['elevated', 'low', 'low'],
      ['elevated', 'mid', 'low'],
      ['elevated', 'high', 'moderate'],

      // severe band
      ['severe', 'low', 'low'],
      ['severe', 'mid', 'moderate'],
      ['severe', 'high', 'high'],

      // extreme band
      ['extreme', 'low', 'moderate'],
      ['extreme', 'mid', 'high'],
      ['extreme', 'high', 'high'],
    ]

    for (const [rti, s, expected] of table) {
      it(`maps (${rti} RTI, ${s} susceptibility) -> ${expected}`, () => {
        expect(riskClass(s, rti)).toBe(expected)
      })
    }
  })
})
