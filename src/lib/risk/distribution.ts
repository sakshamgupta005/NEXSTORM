/**
 * Risk Distribution and Ensemble Confidence Calculations
 */

import type { Confidence, RiskClass } from './types'

export interface RiskDistribution {
  low: number
  moderate: number
  high: number
}

/**
 * Computes normalized distribution fractions of risk classes.
 * Returns fractions summing to 1.0 for non-empty input.
 * For empty input, returns { low: 0, moderate: 0, high: 0 }.
 */
export function classDistribution(classes: RiskClass[]): RiskDistribution {
  if (!classes || classes.length === 0) {
    return { low: 0, moderate: 0, high: 0 }
  }

  let low = 0
  let moderate = 0
  let high = 0

  for (const c of classes) {
    if (c === 'low') low++
    else if (c === 'moderate') moderate++
    else if (c === 'high') high++
  }

  const total = classes.length
  return {
    low: Math.round((low / total) * 1000) / 1000,
    moderate: Math.round((moderate / total) * 1000) / 1000,
    high: Math.round((high / total) * 1000) / 1000,
  }
}

/**
 * Determines the headline displayed risk class based on class probabilities and risk threshold.
 * - 'high' if p.high >= threshold
 * - 'moderate' if p.moderate + p.high >= threshold
 * - 'low' otherwise
 */
export function displayedClass(
  p: RiskDistribution,
  threshold: number = 0.4
): RiskClass {
  if (p.high >= threshold) return 'high'
  if (p.moderate + p.high >= threshold) return 'moderate'
  return 'low'
}

/**
 * Calculates confidence level based on ensemble member agreement.
 * If fewer than two members are supplied, returns 'unavailable' (e.g. single deterministic scenario).
 */
export function confidenceOf(
  classes: RiskClass[],
  displayed: RiskClass
): Confidence {
  if (!classes || classes.length < 2) {
    return 'unavailable'
  }

  let matching = 0
  for (const c of classes) {
    if (c === displayed) matching++
  }

  const share = matching / classes.length

  if (share >= 0.8) return 'high'
  if (share >= 0.5) return 'medium'
  return 'low'
}
