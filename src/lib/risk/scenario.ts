/**
 * Deterministic Scenario Generator and Risk Assessment Service
 */

import { z } from 'zod'
import { getCityConfig, getCitySusceptibility, isCitySupported } from '../city/registry'
import {
  createDerivedRiskProvenance,
  createDerivedSusceptibilityProvenance,
  createSimulatedRainfallProvenance,
} from '../provenance'


import { classDistribution } from './distribution'
import { riskClass, sBand } from './matrix'
import { computeRti, rollingSum, rtiBand } from './rti'
import type { CellRisk, ScenarioResult } from './types'
import { ValueMetaPresets } from '../metadata'

export const ScenarioInputSchema = z.object({
  cityId: z.string().min(1, 'cityId is required'),
  peakMm1h: z.number().min(0, 'peakMm1h must be >= 0').max(120, 'peakMm1h must be <= 120'),
  durationH: z
    .number()
    .int('durationH must be an integer')
    .min(1, 'durationH must be between 1 and 24')
    .max(24, 'durationH must be between 1 and 24'),
  antecedentMm72h: z
    .number()
    .min(0, 'antecedentMm72h must be >= 0')
    .max(300, 'antecedentMm72h must be <= 300'),
})

export type ScenarioInput = z.infer<typeof ScenarioInputSchema>

/**
 * Generates a deterministic triangular hyetograph over a 48-hour window.
 *
 * Formula:
 * - Window size: 48 hours (hours 0..47)
 * - Storm begins at hour 0 and spans durationH hours.
 * - If durationH == 1: hour 0 has peakMm1h; hours 1..47 have 0.
 * - If durationH > 1:
 *     peakIndex = floor((durationH - 1) / 2)
 *     for t <= peakIndex: fraction = (t + 1) / (peakIndex + 1)
 *     for t > peakIndex:  fraction = (durationH - t) / (durationH - peakIndex)
 *     value = peakMm1h * max(0, fraction)
 * - All rainfall after durationH is 0.
 */
export function generateTriangularHyetograph(
  peakMm1h: number,
  durationH: number
): { hours: number[]; values: number[] } {
  const TOTAL_HOURS = 48
  const hours: number[] = []
  const values: number[] = []

  const peakIndex = Math.floor((durationH - 1) / 2)

  for (let t = 0; t < TOTAL_HOURS; t++) {
    hours.push(t)
    if (t >= durationH) {
      values.push(0)
    } else if (durationH === 1) {
      values.push(Math.round(peakMm1h * 100) / 100)
    } else {
      let fraction = 0
      if (t <= peakIndex) {
        fraction = (t + 1) / (peakIndex + 1)
      } else {
        fraction = (durationH - t) / (durationH - peakIndex)
      }
      const val = peakMm1h * Math.max(0, fraction)
      values.push(Math.round(val * 100) / 100)
    }
  }

  return { hours, values }
}

/**
 * Executes full scenario assessment for a validated input:
 * 1. Hyetograph generation
 * 2. Peak rolling rainfall sums (1h, 24h)
 * 3. Max RTI calculation across all 48 hours
 * 4. Cell-level risk classification over city susceptibility grid
 * 5. Overall class distribution share and provenance
 */
export function calculateScenarioRisk(input: ScenarioInput): ScenarioResult {
  if (!isCitySupported(input.cityId)) {
    throw new Error(`Unknown city '${input.cityId}'. Supported cities: amritsar`)
  }

  const cityConfig = getCityConfig(input.cityId)
  const susceptibility = getCitySusceptibility(input.cityId)

  const { hours, values } = generateTriangularHyetograph(
    input.peakMm1h,
    input.durationH
  )

  const sums24h = rollingSum(values, 24)
  const totalMm24h = Math.round(Math.max(...sums24h) * 100) / 100
  const maxMm1h = Math.round(Math.max(...values) * 100) / 100

  // Calculate max RTI across all 48 hours
  let maxRti = 0
  for (let h = 0; h < values.length; h++) {
    const rti = computeRti(values, h, cityConfig.thresholds, input.antecedentMm72h)
    if (rti > maxRti) {
      maxRti = rti
    }
  }
  maxRti = Math.round(maxRti * 1000) / 1000
  const rtiCategory = rtiBand(maxRti)

  // Compute cell-level risk
  const cells: CellRisk[] = susceptibility.features.map((feature) => {
    const s = feature.properties.s
    const sb = sBand(s)
    const c = riskClass(sb, rtiCategory)

    // Single deterministic scenario has confidence = 'unavailable'
    return {
      id: feature.properties.id,
      s,
      class: c,
      p: {
        low: c === 'low' ? 1 : 0,
        moderate: c === 'moderate' ? 1 : 0,
        high: c === 'high' ? 1 : 0,
      },
      confidence: 'unavailable',
    }
  })

  const classShare = classDistribution(cells.map((c) => c.class))

  const provenance = [
    createSimulatedRainfallProvenance(),
    createDerivedSusceptibilityProvenance(cityConfig.configHash),
    createDerivedRiskProvenance(
      cityConfig.thresholds.provisional
        ? 'PROVISIONAL — Relative waterlogging risk estimate based on provisional thresholds.'
        : 'Relative waterlogging risk estimate based on frozen configuration matrix.'
    ),
  ]

  const valueMeta = {
    rainfall24h: ValueMetaPresets.rainfall24h('scenario'),
    rainfall1h: ValueMetaPresets.rainfall1h('scenario'),
    rti: ValueMetaPresets.rti('scenario'),
    riskClass: ValueMetaPresets.riskClass('scenario'),
    susceptibility: ValueMetaPresets.susceptibility(cityConfig.name),
  }

  return {
    rainfall: {
      hours,
      values,
      derived: {
        totalMm24h,
        maxMm1h,
      },
    },
    rti: {
      max: maxRti,
      band: rtiCategory,
    },
    cells,
    classShare,
    provenance,
    valueMeta,
  }
}
