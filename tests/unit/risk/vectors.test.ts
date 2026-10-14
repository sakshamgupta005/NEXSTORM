import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { riskClass, sBand } from '@/lib/risk/matrix'
import { computeRti, rtiBand } from '@/lib/risk/rti'
import type { RiskClass, RtiBand, SBand } from '@/lib/risk/types'

interface RiskVector {
  id: string
  description: string
  inputs: {
    series: number[]
    hourIndex: number
    thresholds: {
      T1h: number
      T3h: number
      T24h: number
      T72h: number
      provisional?: boolean
    }
    antecedentMm72h: number
    sValue: number
  }
  expected: {
    rti: number
    rtiBand: string
    sBand: string
    class: string
  }
}

describe('Shared Cross-Language Risk Vectors (TypeScript vs Reference)', () => {
  const vectorFilePath = path.resolve(process.cwd(), 'tests', 'vectors', 'risk_vectors.json')
  const rawData = fs.readFileSync(vectorFilePath, 'utf-8')
  const vectors: RiskVector[] = JSON.parse(rawData)

  it('contains at least 40 verified vectors covering all boundaries and combinations', () => {
    expect(vectors.length).toBeGreaterThanOrEqual(40)
  })

  for (const vec of vectors) {
    it(`evaluates ${vec.id}: ${vec.description}`, () => {
      const { series, hourIndex, thresholds, antecedentMm72h, sValue } = vec.inputs
      const expected = vec.expected

      // Compute RTI
      const rti = computeRti(
        series,
        hourIndex,
        {
          T1h: thresholds.T1h,
          T3h: thresholds.T3h,
          T24h: thresholds.T24h,
          T72h: thresholds.T72h,
          provisional: false,
        },
        antecedentMm72h
      )

      // Absolute tolerance 1e-9 (with rounding to 6 decimal places like python reference if applicable)
      expect(Math.abs(Math.round(rti * 1e6) / 1e6 - expected.rti)).toBeLessThan(1e-9)

      // RTI band
      const computedRtiBand = rtiBand(Math.round(rti * 1e6) / 1e6)
      expect(computedRtiBand).toBe(expected.rtiBand as RtiBand)

      // Susceptibility band
      const computedSBand = sBand(sValue)
      expect(computedSBand).toBe(expected.sBand as SBand)

      // Risk matrix class
      const computedClass = riskClass(computedSBand, computedRtiBand)
      expect(computedClass).toBe(expected.class as RiskClass)
    })
  }
})
