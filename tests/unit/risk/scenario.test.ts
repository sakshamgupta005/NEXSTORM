import { describe, it, expect } from 'vitest'
import {
  generateTriangularHyetograph,
  calculateScenarioRisk,
} from '@/lib/risk/scenario'

describe('Scenario Engine & Triangular Hyetograph', () => {
  describe('generateTriangularHyetograph()', () => {
    it('generates 48-hour series with duration = 1 and peakMm1h', () => {
      const { hours, values } = generateTriangularHyetograph(50, 1)
      expect(hours).toHaveLength(48)
      expect(values).toHaveLength(48)
      expect(values[0]).toBe(50)
      for (let i = 1; i < 48; i++) {
        expect(values[i]).toBe(0)
      }
    })

    it('peaks at peakMm1h and drops to 0 after durationH', () => {
      const peak = 80
      const duration = 6
      const { values } = generateTriangularHyetograph(peak, duration)

      const maxVal = Math.max(...values)
      expect(maxVal).toBe(peak)

      // After duration, all hours must be 0
      for (let t = duration; t < 48; t++) {
        expect(values[t]).toBe(0)
      }
    })
  })

  describe('calculateScenarioRisk()', () => {
    it('executes scenario risk assessment for Amritsar and returns validated contract', () => {
      const result = calculateScenarioRisk({
        cityId: 'amritsar',
        peakMm1h: 45,
        durationH: 4,
        antecedentMm72h: 20,
      })

      expect(result.rainfall.hours).toHaveLength(48)
      expect(result.rainfall.derived.maxMm1h).toBe(45)
      expect(result.rainfall.derived.totalMm24h).toBeGreaterThan(0)
      expect(result.rti.max).toBeGreaterThan(0)
      expect(['none', 'elevated', 'severe', 'extreme']).toContain(result.rti.band)
      expect(result.cells.length).toBeGreaterThan(1000)

      // Single deterministic scenario has unavailable confidence
      expect(result.cells[0].confidence).toBe('unavailable')

      // Class share sums to 1.0
      const sum =
        result.classShare.low +
        result.classShare.moderate +
        result.classShare.high
      expect(sum).toBeCloseTo(1.0, 2)

      // Provenance explicitly includes simulated and derived tags with DEMO DATA
      expect(result.provenance.some((p) => p.kind === 'simulated')).toBe(true)
      expect(result.provenance.some((p) => p.note?.includes('DEMO DATA'))).toBe(true)
    })

    it('throws when cityId is unknown', () => {
      expect(() =>
        calculateScenarioRisk({
          cityId: 'unknown_city',
          peakMm1h: 20,
          durationH: 2,
          antecedentMm72h: 0,
        })
      ).toThrow(/Unknown city/)
    })
  })
})
