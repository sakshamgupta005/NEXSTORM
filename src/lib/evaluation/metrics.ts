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
