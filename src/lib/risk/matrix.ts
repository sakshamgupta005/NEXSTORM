/**
 * 2D Susceptibility-Rainfall Risk Matrix Mapping
 */

import type { RiskClass, RtiBand, SBand } from './types'

/**
 * Categorizes continuous susceptibility index s (0..1) into bands:
 * - s < 0.33: low
 * - 0.33 <= s <= 0.66: mid
 * - s > 0.66: high
 */
export function sBand(s: number): SBand {
  if (typeof s !== 'number' || !Number.isFinite(s) || s < 0 || s > 1) {
    throw new Error(`Susceptibility index s must be between 0 and 1, received: ${s}`)
  }
  if (s < 0.33) return 'low'
  if (s <= 0.66) return 'mid'
  return 'high'
}

/**
 * 12-cell combination matrix mapping (sBand x rtiBand) -> RiskClass
 */
export function riskClass(s: SBand, rti: RtiBand): RiskClass {
  switch (rti) {
    case 'none':
      return 'low'
    case 'elevated':
      return s === 'high' ? 'moderate' : 'low'
    case 'severe':
      if (s === 'low') return 'low'
      if (s === 'mid') return 'moderate'
      return 'high'
    case 'extreme':
      if (s === 'low') return 'moderate'
      return 'high'
  }
}
