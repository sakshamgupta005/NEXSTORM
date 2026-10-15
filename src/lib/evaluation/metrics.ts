/**
 * src/lib/evaluation/metrics.ts
 * Pure evaluation and contingency table metrics.
 * Follows exact formulations from the hydrometeorological evaluation pipeline.
 * Undefined metrics with zero denominators return null explicitly rather than 0.
 */

/**
 * Probability of Detection (POD) = Hits / (Hits + Misses)
 * Returns null if (Hits + Misses) == 0.
 */
export function pod(hits: number, misses: number): number | null {
  if (hits < 0 || misses < 0) throw new Error('Hits and misses must be non-negative')
  const total = hits + misses
  if (total === 0) return null
  return Math.round((hits / total) * 10000) / 10000
}

/**
 * False Alarm Ratio (FAR) = FalseAlarms / (Hits + FalseAlarms)
 * Returns null if (Hits + FalseAlarms) == 0.
 */
export function far(hits: number, falseAlarms: number): number | null {
  if (hits < 0 || falseAlarms < 0) throw new Error('Hits and falseAlarms must be non-negative')
  const total = hits + falseAlarms
  if (total === 0) return null
  return Math.round((falseAlarms / total) * 10000) / 10000
}

/**
 * Critical Success Index (CSI) = Hits / (Hits + FalseAlarms + Misses)
 * Returns null if (Hits + FalseAlarms + Misses) == 0.
 */
export function csi(hits: number, falseAlarms: number, misses: number): number | null {
  if (hits < 0 || falseAlarms < 0 || misses < 0) {
    throw new Error('Counts must be non-negative')
  }
  const total = hits + falseAlarms + misses
  if (total === 0) return null
  return Math.round((hits / total) * 10000) / 10000
}

/**
 * Frequency Bias = (Hits + FalseAlarms) / (Hits + Misses)
 * Returns null if (Hits + Misses) == 0.
 */
export function frequencyBias(hits: number, falseAlarms: number, misses: number): number | null {
  if (hits < 0 || falseAlarms < 0 || misses < 0) {
    throw new Error('Counts must be non-negative')
  }
  const totalObserved = hits + misses
  if (totalObserved === 0) return null
  return Math.round(((hits + falseAlarms) / totalObserved) * 10000) / 10000
}

/**
 * Wilson score interval for binomial proportion.
 * Symmetric and robust for small sample sizes and proportions near boundaries.
 */
export function wilsonInterval(
  k: number,
  n: number,
  confidence: number = 0.95
): [number, number] {
  if (n <= 0) return [0.0, 1.0]
  if (k < 0 || k > n) throw new Error(`Invalid counts: k=${k}, n=${n}`)

  const z = confidence === 0.95 ? 1.95996 : 1.95996
  const p = k / n
  const denom = 1.0 + (z * z) / n
  const center = (p + (z * z) / (2.0 * n)) / denom
  const margin = (z * Math.sqrt((p * (1.0 - p)) / n + (z * z) / (4.0 * n * n))) / denom

  return [
    Math.round(Math.max(0.0, center - margin) * 10000) / 10000,
    Math.round(Math.min(1.0, center + margin) * 10000) / 10000,
  ]
}

function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1
  let c = 1
  for (let i = 1; i <= k; i++) {
    c = (c * (n - (k - i))) / i
  }
  return c
}

/**
 * Clopper-Pearson Exact Binomial Confidence Interval via Binary Search.
 */
export function binomialCI(
  k: number,
  n: number,
  confidence: number = 0.95
): [number, number] {
  if (n <= 0) return [0.0, 1.0]
  if (k < 0 || k > n) throw new Error(`Invalid counts: k=${k}, n=${n}`)

  const alpha2 = (1.0 - confidence) / 2.0

  let lower = 0.0
  if (k > 0) {
    let low = 0.0
    let high = k / n
    for (let iter = 0; iter < 40; iter++) {
      const mid = (low + high) / 2.0
      let tail = 0.0
      for (let i = k; i <= n; i++) {
        tail += combinations(n, i) * Math.pow(mid, i) * Math.pow(1.0 - mid, n - i)
      }
      if (tail > alpha2) {
        high = mid
      } else {
        low = mid
      }
    }
    lower = Math.round(((low + high) / 2.0) * 10000) / 10000
  }

  let upper = 1.0
  if (k < n) {
    let low = k / n
    let high = 1.0
    for (let iter = 0; iter < 40; iter++) {
      const mid = (low + high) / 2.0
      let tail = 0.0
      for (let i = 0; i <= k; i++) {
        tail += combinations(n, i) * Math.pow(mid, i) * Math.pow(1.0 - mid, n - i)
      }
      if (tail > alpha2) {
        low = mid
      } else {
        high = mid
      }
    }
    upper = Math.round(((low + high) / 2.0) * 10000) / 10000
  }

  return [lower, upper]
}

/**
 * Computes Area Under the ROC Curve (ROC-AUC) via Mann-Whitney U statistic.
 * Validates array lengths and non-empty classes.
 */
export function rocAuc(yTrue: number[], yScores: number[]): number {
  if (!Array.isArray(yTrue) || !Array.isArray(yScores) || yTrue.length !== yScores.length) {
    throw new Error('Array lengths must match for ROC-AUC computation')
  }

  const pos: number[] = []
  const neg: number[] = []

  for (let i = 0; i < yTrue.length; i++) {
    const val = yTrue[i]
    const score = yScores[i]
    if (typeof score !== 'number' || !Number.isFinite(score)) {
      throw new Error(`Invalid score at index ${i}: ${score}`)
    }
    if (val === 1) {
      pos.push(score)
    } else if (val === 0) {
      neg.push(score)
    } else {
      throw new Error(`yTrue values must be 0 or 1, received ${val} at index ${i}`)
    }
  }

  if (pos.length === 0 || neg.length === 0) {
    return 0.5
  }

  let u = 0
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < neg.length; j++) {
      if (pos[i] > neg[j]) {
        u += 1.0
      } else if (pos[i] === neg[j]) {
        u += 0.5
      }
    }
  }

  return Math.round((u / (pos.length * neg.length)) * 10000) / 10000
}

/**
 * Computes Brier Score: Mean squared error between forecast probabilities and binary outcomes.
 * Lower is better (0.0 = perfect probabilistic forecast).
 */
export function brierScore(forecasts: number[], observed: number[]): number {
  if (!Array.isArray(forecasts) || !Array.isArray(observed) || forecasts.length !== observed.length) {
    throw new Error('Array lengths must match for Brier score computation')
  }
  if (forecasts.length === 0) {
    throw new Error('Cannot compute Brier score on empty arrays')
  }

  let sumSqErr = 0
  for (let i = 0; i < forecasts.length; i++) {
    const f = forecasts[i]
    const o = observed[i]
    if (typeof f !== 'number' || !Number.isFinite(f) || f < 0 || f > 1) {
      throw new Error(`Invalid forecast probability at index ${i}: ${f}`)
    }
    if (o !== 0 && o !== 1) {
      throw new Error(`Invalid observed binary outcome at index ${i}: ${o}`)
    }
    sumSqErr += Math.pow(f - o, 2)
  }

  return Math.round((sumSqErr / forecasts.length) * 10000) / 10000
}

/**
 * Computes Brier Skill Score (BSS) relative to a reference / climatological baseline forecast.
 * BSS = 1 - (BrierScore / BrierScoreRef)
 */
export function brierSkillScore(brier: number, brierRef: number): number | null {
  if (brierRef <= 0) return null
  return Math.round((1.0 - brier / brierRef) * 10000) / 10000
}

/**
 * Computes lift and capture rate at a specific top percentile cutoff.
 */
export function liftAtPercentile(
  scores: number[],
  isHotspot: number[],
  topPercent: number
): {
  cutoff: number
  captured: number
  totalHotspots: number
  captureRate: number
  expectedRate: number
  lift: number
} {
  if (topPercent <= 0 || topPercent >= 100) {
    throw new Error('topPercent must be between 0 and 100')
  }
  if (scores.length !== isHotspot.length || scores.length === 0) {
    throw new Error('Arrays must be non-empty and of equal length')
  }

  const totalHotspots = isHotspot.reduce((acc, v) => acc + (v === 1 ? 1 : 0), 0)
  if (totalHotspots === 0) {
    return {
      cutoff: 0,
      captured: 0,
      totalHotspots: 0,
      captureRate: 0,
      expectedRate: topPercent / 100,
      lift: 1.0,
    }
  }

  const sortedScores = [...scores].sort((a, b) => a - b)
  const cutIndex = Math.floor(sortedScores.length * (1.0 - topPercent / 100))
  const cutoff = sortedScores[cutIndex]

  let captured = 0
  for (let i = 0; i < scores.length; i++) {
    if (isHotspot[i] === 1 && scores[i] >= cutoff) {
      captured++
    }
  }

  const captureRate = Math.round((captured / totalHotspots) * 10000) / 10000
  const expectedRate = Math.round((topPercent / 100) * 10000) / 10000
  const lift = Math.round((captureRate / expectedRate) * 100) / 100

  return {
    cutoff: Math.round(cutoff * 10000) / 10000,
    captured,
    totalHotspots,
    captureRate,
    expectedRate,
    lift,
  }
}

