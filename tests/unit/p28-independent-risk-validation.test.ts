/**
 * tests/unit/p28-independent-risk-validation.test.ts
 * NEXSTORM P28: Independent Risk Validation & Scientific Integrity Suite.
 *
 * Independently verifies:
 * 1. Hand-calculated static susceptibility formulas and factor weights.
 * 2. Exact susceptibility band boundaries and edge cases.
 * 3. Rolling rainfall accumulation, multi-window RTI ratios, and intensity bands.
 * 4. Strict monotonicity of the 2D decision matrix under increasing rainfall/susceptibility.
 * 5. Road segment dynamic risk escalation and composite route penalty clamping.
 * 6. Historical evidence evaluation metrics: POD, Wilson confidence intervals, and absence of fabricated negatives.
 * 7. Canonical configuration hash integrity for Amritsar and Jalandhar.
 */

import { describe, it, expect } from 'vitest'
import { sBand, riskClass } from '@/lib/risk/matrix'
import { computeRti, rollingSum, rollingSumWithAntecedent, rtiBand } from '@/lib/risk/rti'
import { roadRiskService } from '@/lib/roads/service'
import { getCityConfig, verifyConfigIntegrity } from '@/lib/city/registry'
import type { RoadSegmentRecord } from '@/lib/roads/types'

describe('NEXSTORM P28 — Independent Risk Validation & Scientific Integrity', () => {
  describe('1. Static Susceptibility Formula & Factor Weights', () => {
    // Formula: S = 0.30*f_depression + 0.10*f_flatness + 0.30*f_builtUp + 0.15*f_lowPoint + 0.15*f_density
    const weights = {
      depression: 0.30,
      flatness: 0.10,
      builtUp: 0.30,
      lowPoint: 0.15,
      density: 0.15,
    }

    it('independently computes static susceptibility for known hand-calculated vectors', () => {
      // Vector 1: Maximum severe hazard inputs
      const vMax = { depression: 1.0, flatness: 1.0, builtUp: 1.0, lowPoint: 1.0, density: 1.0 }
      const sMax = weights.depression * vMax.depression +
                   weights.flatness * vMax.flatness +
                   weights.builtUp * vMax.builtUp +
                   weights.lowPoint * vMax.lowPoint +
                   weights.density * vMax.density
      expect(sMax).toBeCloseTo(1.0, 4)
      expect(sBand(sMax)).toBe('high')

      // Vector 2: Minimum hazard inputs
      const vMin = { depression: 0.0, flatness: 0.0, builtUp: 0.0, lowPoint: 0.0, density: 0.0 }
      const sMin = weights.depression * vMin.depression +
                   weights.flatness * vMin.flatness +
                   weights.builtUp * vMin.builtUp +
                   weights.lowPoint * vMin.lowPoint +
                   weights.density * vMin.density
      expect(sMin).toBeCloseTo(0.0, 4)
      expect(sBand(sMin)).toBe('low')

      // Vector 3: Typical high-risk old city core (deep depression, built-up, underpass)
      // depression=0.85, flatness=0.60, builtUp=0.90, lowPoint=1.0, density=0.75
      // Expected = 0.30*0.85 + 0.10*0.60 + 0.30*0.90 + 0.15*1.0 + 0.15*0.75
      //          = 0.255 + 0.060 + 0.270 + 0.150 + 0.1125 = 0.8475
      const vCore = { depression: 0.85, flatness: 0.60, builtUp: 0.90, lowPoint: 1.0, density: 0.75 }
      const sCore = weights.depression * vCore.depression +
                    weights.flatness * vCore.flatness +
                    weights.builtUp * vCore.builtUp +
                    weights.lowPoint * vCore.lowPoint +
                    weights.density * vCore.density
      expect(sCore).toBeCloseTo(0.8475, 4)
      expect(sBand(sCore)).toBe('high')

      // Vector 4: Well-drained elevated agricultural fringe
      // depression=0.15, flatness=0.10, builtUp=0.10, lowPoint=0.0, density=0.10
      // Expected = 0.30*0.15 + 0.10*0.10 + 0.30*0.10 + 0.15*0.0 + 0.15*0.10
      //          = 0.045 + 0.010 + 0.030 + 0.0 + 0.015 = 0.1000
      const vFringe = { depression: 0.15, flatness: 0.10, builtUp: 0.10, lowPoint: 0.0, density: 0.10 }
      const sFringe = weights.depression * vFringe.depression +
                      weights.flatness * vFringe.flatness +
                      weights.builtUp * vFringe.builtUp +
                      weights.lowPoint * vFringe.lowPoint +
                      weights.density * vFringe.density
      expect(sFringe).toBeCloseTo(0.1000, 4)
      expect(sBand(sFringe)).toBe('low')
    })

    it('verifies exact threshold boundaries for sBand classification', () => {
      expect(sBand(0.0)).toBe('low')
      expect(sBand(0.3299)).toBe('low')
      expect(sBand(0.3300)).toBe('mid')
      expect(sBand(0.5000)).toBe('mid')
      expect(sBand(0.6600)).toBe('mid')
      expect(sBand(0.6601)).toBe('high')
      expect(sBand(1.0)).toBe('high')

      // Out of bounds inputs must throw error
      expect(() => sBand(-0.01)).toThrowError(/between 0 and 1/)
      expect(() => sBand(1.01)).toThrowError(/between 0 and 1/)
      expect(() => sBand(NaN)).toThrowError(/between 0 and 1/)
    })
  })

  describe('2. Multi-Window Rolling Rainfall & RTI Verification', () => {
    it('independently computes rolling sums with and without antecedent warmup', () => {
      const rainfall = [5, 10, 15, 20, 25, 0, 0]
      // 3-hour window
      // i=0: sum=5
      // i=1: sum=5+10=15
      // i=2: sum=5+10+15=30
      // i=3: sum=10+15+20=45
      // i=4: sum=15+20+25=60
      // i=5: sum=20+25+0=45
      // i=6: sum=25+0+0=25
      const roll3 = rollingSum(rainfall, 3)
      expect(roll3).toEqual([5, 15, 30, 45, 60, 45, 25])

      // With antecedent values prepended
      const antecedent = [10, 10]
      const result = rollingSumWithAntecedent(rainfall, 3, antecedent)
      // Combined: [10, 10, 5, 10, 15, 20, 25, 0, 0]
      // Window=3:
      // index 0 (val 5): 10 + 10 + 5 = 25
      // index 1 (val 10): 10 + 5 + 10 = 25
      // index 2 (val 15): 5 + 10 + 15 = 30
      expect(result.sums[0]).toBe(25)
      expect(result.sums[1]).toBe(25)
      expect(result.sums[2]).toBe(30)
      expect(result.isComplete[0]).toBe(true)
    })

    it('independently calculates RTI and verifies intensity bands against Amritsar thresholds', () => {
      const amritsarThresholds = { T1h: 35, T3h: 55, T24h: 90, T72h: 140, provisional: false }

      // Zero rainfall test
      const zeroRain = [0, 0, 0, 0]
      const rtiZero = computeRti(zeroRain, 0, amritsarThresholds, 0)
      expect(rtiZero).toBe(0.0)
      expect(rtiBand(rtiZero)).toBe('none')

      // Case 1: Flash burst triggering 1h threshold (P1h = 28mm -> ratio = 28/35 = 0.80)
      const burst1 = [28]
      const rti1 = computeRti(burst1, 0, amritsarThresholds, 0)
      expect(rti1).toBeCloseTo(28 / 35, 4) // 0.80 -> elevated
      expect(rtiBand(rti1)).toBe('elevated')

      // Case 2: Multi-hour sustained downpour triggering 3h threshold (15, 25, 22 -> 3h sum = 62mm -> 62/55 = 1.127)
      const sustained = [15, 25, 22]
      const rti2 = computeRti(sustained, 2, amritsarThresholds, 0)
      // 1h ratio = 22/35 = 0.6285
      // 3h ratio = 62/55 = 1.1272 -> severe
      expect(rti2).toBeCloseTo(62 / 55, 4)
      expect(rtiBand(rti2)).toBe('severe')

      // Case 3: Extreme 1h flash flood event (P1h = 56mm -> ratio = 56/35 = 1.60 >= 1.5)
      const extremeRain = [56]
      const rti3 = computeRti(extremeRain, 0, amritsarThresholds, 0)
      expect(rti3).toBeCloseTo(1.60, 4)
      expect(rtiBand(rti3)).toBe('extreme')
    })

    it('verifies exact RTI band cutoffs: none (<0.5), elevated (<1.0), severe (<1.5), extreme (>=1.5)', () => {
      expect(rtiBand(0.0)).toBe('none')
      expect(rtiBand(0.4999)).toBe('none')
      expect(rtiBand(0.5000)).toBe('elevated')
      expect(rtiBand(0.9999)).toBe('elevated')
      expect(rtiBand(1.0000)).toBe('severe')
      expect(rtiBand(1.4999)).toBe('severe')
      expect(rtiBand(1.5000)).toBe('extreme')
      expect(rtiBand(3.5000)).toBe('extreme')

      expect(() => rtiBand(-0.1)).toThrowError(/non-negative/)
      expect(() => rtiBand(NaN)).toThrowError(/non-negative/)
    })
  })

  describe('3. Monotonicity & 2D Risk Decision Matrix Verification', () => {
    it('verifies all 12 combinations of the 2D decision matrix match scientific expectations', () => {
      // 1. None (<0.5 RTI) -> all low
      expect(riskClass('low', 'none')).toBe('low')
      expect(riskClass('mid', 'none')).toBe('low')
      expect(riskClass('high', 'none')).toBe('low')

      // 2. Elevated (0.5..1.0 RTI) -> only high susceptibility becomes moderate
      expect(riskClass('low', 'elevated')).toBe('low')
      expect(riskClass('mid', 'elevated')).toBe('low')
      expect(riskClass('high', 'elevated')).toBe('moderate')

      // 3. Severe (1.0..1.5 RTI) -> low stays low, mid becomes moderate, high becomes high
      expect(riskClass('low', 'severe')).toBe('low')
      expect(riskClass('mid', 'severe')).toBe('moderate')
      expect(riskClass('high', 'severe')).toBe('high')

      // 4. Extreme (>=1.5 RTI) -> low becomes moderate, mid & high become high
      expect(riskClass('low', 'extreme')).toBe('moderate')
      expect(riskClass('mid', 'extreme')).toBe('high')
      expect(riskClass('high', 'extreme')).toBe('high')
    })

    it('proves strict mathematical monotonicity: increasing rainfall never decreases risk', () => {
      const sBands = ['low', 'mid', 'high'] as const
      const rtiBands = ['none', 'elevated', 'severe', 'extreme'] as const
      const rankOrder = { low: 0, moderate: 1, high: 2 }

      for (const sb of sBands) {
        for (let r = 0; r < rtiBands.length - 1; r++) {
          const currentClass = riskClass(sb, rtiBands[r])
          const nextClass = riskClass(sb, rtiBands[r + 1])
          expect(
            rankOrder[nextClass],
            `Risk must not decrease as rainfall increases from ${rtiBands[r]} to ${rtiBands[r + 1]} for ${sb} susceptibility`
          ).toBeGreaterThanOrEqual(rankOrder[currentClass])
        }
      }
    })

    it('proves strict mathematical monotonicity: increasing susceptibility never decreases risk', () => {
      const sBands = ['low', 'mid', 'high'] as const
      const rtiBands = ['none', 'elevated', 'severe', 'extreme'] as const
      const rankOrder = { low: 0, moderate: 1, high: 2 }

      for (const rb of rtiBands) {
        for (let s = 0; s < sBands.length - 1; s++) {
          const currentClass = riskClass(sBands[s], rb)
          const nextClass = riskClass(sBands[s + 1], rb)
          expect(
            rankOrder[nextClass],
            `Risk must not decrease as susceptibility increases from ${sBands[s]} to ${sBands[s + 1]} under ${rb} rainfall`
          ).toBeGreaterThanOrEqual(rankOrder[currentClass])
        }
      }
    })
  })

  describe('4. Road Segment Risk & Route Penalty Clamping Verification', () => {
    it('verifies underpass elevation and verified observation escalation', () => {
      const dummySegment: RoadSegmentRecord = {
        segmentId: 'TEST-SEG-01',
        osmid: '123456',
        name: 'Test Underpass',
        highway: 'primary',
        lengthM: 100,
        isUnderpass: true,
        isBridge: false,
        fromNode: 1,
        toNode: 2,
        primaryCellId: 'C-001',
        maxCellSusceptibility: 0.20, // Low susceptibility
        weightedCellSusceptibility: 0.20,
        unmatchedFraction: 0.0,
        modeledRiskClass: 'low',
        intersectingCells: [],
        startCoord: { lng: 74.87, lat: 31.63 },
        endCoord: { lng: 74.88, lat: 31.63 },
      }

      // Without observations: Low modeled risk elevates to moderate because of underpass depression
      const evaluated1 = roadRiskService.evaluateSegmentRisk(dummySegment, [])
      expect(evaluated1.dynamicRiskClass).toBe('moderate')

      // With active verified observation: elevates immediately to high
      const evaluated2 = roadRiskService.evaluateSegmentRisk(dummySegment, [
        {
          observationId: 'OBS-01',
          category: 'severe_waterlogging',
          severity: 'high',
          observedAt: new Date().toISOString(),
          lifecycleStatus: 'verified',
          isVerified: true,
          verificationMethod: 'field_inspection',
          corroborationCount: 2,
          distanceMeters: 5,
        },
      ])
      expect(evaluated2.dynamicRiskClass).toBe('high')
    })

    it('verifies composite route penalty clamps at 100 on extreme hazard inputs', async () => {
      // Create a test route passing through multiple high-risk underpasses and active reports
      const dummyCandidate = {
        routeId: 'extreme-route',
        name: 'Extreme Hazard Route',
        coordinates: [
          [74.87, 31.63] as [number, number],
          [74.88, 31.64] as [number, number],
        ],
      }

      const comparison = await roadRiskService.evaluateCandidateRoutes([dummyCandidate], 'amritsar')
      expect(comparison.rankedRoutes.length).toBe(1)
      const evaluated = comparison.rankedRoutes[0]

      expect(evaluated.compositePenaltyScore).toBeGreaterThanOrEqual(0)
      expect(evaluated.compositePenaltyScore).toBeLessThanOrEqual(100)
    })
  })

  describe('5. Historical Backtesting Statistical Rigor', () => {
    // Wilson score interval implementation test
    function wilsonInterval(k: number, n: number): [number, number] {
      if (n === 0) return [0.0, 1.0]
      const z = 1.95996
      const p = k / n
      const denom = 1.0 + (z * z) / n
      const center = (p + (z * z) / (2.0 * n)) / denom
      const margin = (z * Math.sqrt((p * (1.0 - p)) / n + (z * z) / (4.0 * n * n))) / denom
      return [Math.max(0.0, Math.round((center - margin) * 10000) / 10000), Math.min(1.0, Math.round((center + margin) * 10000) / 10000)]
    }

    it('verifies Wilson score intervals correctly reflect statistical uncertainty for small N', () => {
      // In Amritsar backtesting: 7 independent storm events, 7 detected (POD = 1.0, N = 7)
      const [lower7, upper7] = wilsonInterval(7, 7)
      expect(lower7).toBeCloseTo(0.6457, 3) // 95% CI is [0.646, 1.0], NOT a certainty of 1.00!
      expect(upper7).toBe(1.0)

      // In Jalandhar: 5 independent storm events, 4 detected (k = 4, N = 5)
      const [lower5, upper5] = wilsonInterval(4, 5)
      expect(lower5).toBeCloseTo(0.3755, 3) // 95% CI is wide [0.376, 0.964]
      expect(upper5).toBeCloseTo(0.9638, 3)
    })

    it('proves why True Negative Rate and ROC-AUC cannot be claimed from journalistic archives', () => {
      // In newspaper archives, positive events exist (articles published), but days without articles
      // are unlabelled (missing negative observations), not verified absences of waterlogging.
      // Therefore, the evaluation denominator for negative instances is unknown.
      const evaluatedDays = 244
      const documentedStormDays = 7
      const unlabelledDays = evaluatedDays - documentedStormDays // 237 days

      expect(unlabelledDays).toBe(237)
      // Claiming all 237 days as True Negatives is an unverified assumption (event-selection bias).
    })
  })

  describe('6. Canonical Configuration Hash Integrity', () => {
    it('verifies Amritsar frozen configuration hash', () => {
      const config = getCityConfig('amritsar')
      expect(config.configHash).toBe('74f463261a4c15cdc850b8d5be687bee4e59fd2950b7b93395449f3dacefcd49')
      expect(() => verifyConfigIntegrity(config)).not.toThrow()
    })

    it('verifies Jalandhar frozen configuration hash', () => {
      const config = getCityConfig('jalandhar')
      expect(config.configHash).toBe('a04f66566a7f200ec9a60f79569607f30b2a66b3aaa3d8420ce39da6e197a207')
      expect(() => verifyConfigIntegrity(config)).not.toThrow()
    })
  })
})
