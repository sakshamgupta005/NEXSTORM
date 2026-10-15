/**
 * Rainfall Threshold Index (RTI) calculations and rolling rainfall window aggregations.
 */

import type { RtiBand, RtiThresholds } from './types'

/**
 * Calculates rolling trailing sums over a given window.
 * For indices before a complete window exists, sums all available preceding values.
 *
 * @throws Error on invalid window or negative/non-finite rainfall values.
 */
export function rollingSum(series: number[], window: number): number[] {
  if (!Number.isInteger(window) || window <= 0) {
    throw new Error('Window size must be a positive integer')
  }

  if (series.length === 0) {
    return []
  }

  for (let i = 0; i < series.length; i++) {
    const v = series[i]
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new Error(`Invalid rainfall value at index ${i}: must be a finite non-negative number`)
    }
  }

  const result: number[] = new Array(series.length)
  let currentSum = 0

  for (let i = 0; i < series.length; i++) {
    currentSum += series[i]
    if (i >= window) {
      currentSum -= series[i - window]
    }
    // Round to avoid floating point precision artifacts
    result[i] = Math.round(currentSum * 1e6) / 1e6
  }

  return result
}

export interface RollingAccumulationResult {
  sums: number[]
  isComplete: boolean[]
}

/**
 * Calculates rolling trailing sums with antecedent values prepended.
 * If antecedent array is provided (e.g. 72 hours preceding the evaluation window),
 * each hour in series incorporates the antecedent values seamlessly, and isComplete
 * accurately flags whether a full window (antecedent + series) was available.
 */
export function rollingSumWithAntecedent(
  series: number[],
  window: number,
  antecedent: number[] = []
): RollingAccumulationResult {
  if (!Number.isInteger(window) || window <= 0) {
    throw new Error('Window size must be a positive integer')
  }

  const combined = [...antecedent, ...series]
  const combinedSums = rollingSum(combined, window)

  const offset = antecedent.length
  const n = series.length
  const sums: number[] = new Array(n)
  const isComplete: boolean[] = new Array(n)

  for (let i = 0; i < n; i++) {
    const combinedIdx = offset + i
    sums[i] = combinedSums[combinedIdx]
    isComplete[i] = combinedIdx + 1 >= window
  }

  return { sums, isComplete }
}

/**
 * Computes the Rainfall Threshold Index (RTI) at a given hourIndex.
 * RTI = max(P1h/T1h, P3h/T3h, P24h/T24h, (P72h + antecedentMm72h)/T72h)
 */
export function computeRti(
  member: number[],
  hourIndex: number,
  thresholds: RtiThresholds,
  antecedentMm72h: number = 0
): number {
  if (hourIndex < 0 || hourIndex >= member.length) {
    throw new Error(`Invalid hourIndex ${hourIndex}: out of bounds for series length ${member.length}`)
  }

  if (
    !thresholds ||
    thresholds.T1h <= 0 ||
    thresholds.T3h <= 0 ||
    thresholds.T24h <= 0 ||
    thresholds.T72h <= 0
  ) {
    throw new Error('All RTI thresholds (T1h, T3h, T24h, T72h) must be positive numbers')
  }

  if (typeof antecedentMm72h !== 'number' || !Number.isFinite(antecedentMm72h) || antecedentMm72h < 0) {
    throw new Error('antecedentMm72h must be a finite non-negative number')
  }

  const p1h = rollingSum(member, 1)[hourIndex]
  const p3h = rollingSum(member, 3)[hourIndex]
  const p24h = rollingSum(member, 24)[hourIndex]
  const p72h = rollingSum(member, 72)[hourIndex]

  const ratio1h = p1h / thresholds.T1h
  const ratio3h = p3h / thresholds.T3h
  const ratio24h = p24h / thresholds.T24h
  const ratio72h = (p72h + antecedentMm72h) / thresholds.T72h

  return Math.max(ratio1h, ratio3h, ratio24h, ratio72h)
}

/**
 * Computes RTI values across the entire series in a single optimized pass.
 */
export function computeRtiSeries(
  member: number[],
  thresholds: RtiThresholds,
  antecedentMm72h: number = 0
): number[] {
  if (
    !thresholds ||
    thresholds.T1h <= 0 ||
    thresholds.T3h <= 0 ||
    thresholds.T24h <= 0 ||
    thresholds.T72h <= 0
  ) {
    throw new Error('All RTI thresholds (T1h, T3h, T24h, T72h) must be positive numbers')
  }

  if (typeof antecedentMm72h !== 'number' || !Number.isFinite(antecedentMm72h) || antecedentMm72h < 0) {
    throw new Error('antecedentMm72h must be a finite non-negative number')
  }

  const p1 = rollingSum(member, 1)
  const p3 = rollingSum(member, 3)
  const p24 = rollingSum(member, 24)
  const p72 = rollingSum(member, 72)

  const n = member.length
  const result: number[] = new Array(n)

  for (let i = 0; i < n; i++) {
    const r1 = p1[i] / thresholds.T1h
    const r3 = p3[i] / thresholds.T3h
    const r24 = p24[i] / thresholds.T24h
    const r72 = (p72[i] + antecedentMm72h) / thresholds.T72h
    result[i] = Math.round(Math.max(r1, r3, r24, r72) * 1e6) / 1e6
  }

  return result
}

/**
 * Maps RTI value to its categorical rainfall intensity band.
 * - < 0.5: none
 * - < 1.0: elevated
 * - < 1.5: severe
 * - >= 1.5: extreme
 */
export function rtiBand(rti: number): RtiBand {
  if (!Number.isFinite(rti) || rti < 0) {
    throw new Error('RTI must be a non-negative finite number')
  }
  if (rti < 0.5) return 'none'
  if (rti < 1.0) return 'elevated'
  if (rti < 1.5) return 'severe'
  return 'extreme'
}

