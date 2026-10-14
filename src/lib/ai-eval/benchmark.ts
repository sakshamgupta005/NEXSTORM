/**
 * AI Benchmark & Regression Detection Engine
 * 
 * Capabilities:
 * - Compares evaluation runs against saved baselines
 * - Computes deltas for pass rate, average score, latency, and cost
 * - Flags individual test case regressions
 * - Enforces configurable regression thresholds for CI / quality gates
 */

import type {
  BaselineComparison,
  EvalReport,
  ImprovedCase,
  RegressedCase,
  RegressionThresholds,
} from './types'

export const DEFAULT_REGRESSION_THRESHOLDS: RegressionThresholds = {
  maxPassRateDrop: 0.05, // Disallow > 5% drop in pass rate
  maxScoreDrop: 0.05, // Disallow > 0.05 drop in overall score
  maxLatencyIncreasePercent: 30, // Disallow > 30% latency degradation
  maxCostIncreasePercent: 25, // Disallow > 25% cost increase
  allowZeroRegressions: false,
}

export function compareWithBaseline(
  current: EvalReport,
  baseline: EvalReport,
  thresholds: RegressionThresholds = DEFAULT_REGRESSION_THRESHOLDS
): BaselineComparison {
  const passRateDelta = Math.round((current.passRate - baseline.passRate) * 1000) / 1000
  const averageScoreDelta = Math.round((current.averageScore - baseline.averageScore) * 1000) / 1000
  const latencyDeltaMs = current.averageLatencyMs - baseline.averageLatencyMs
  const latencyPercentDelta =
    baseline.averageLatencyMs > 0
      ? Math.round(((current.averageLatencyMs - baseline.averageLatencyMs) / baseline.averageLatencyMs) * 1000) / 10
      : 0

  let costDeltaUsd: number | undefined = undefined
  if (current.totalCostUsd !== undefined && baseline.totalCostUsd !== undefined) {
    costDeltaUsd = Math.round((current.totalCostUsd - baseline.totalCostUsd) * 1_000_000) / 1_000_000
  }

  // Map baseline cases by ID
  const baselineCaseMap = new Map(baseline.results.map((r) => [r.testCaseId, r]))

  const regressedCases: RegressedCase[] = []
  const improvedCases: ImprovedCase[] = []
  let unchangedCount = 0

  for (const curr of current.results) {
    const base = baselineCaseMap.get(curr.testCaseId)
    if (!base) continue

    const scoreDiff = Math.round((curr.overallScore - base.overallScore) * 1000) / 1000

    if (scoreDiff < -0.05) {
      // Regressed
      const failedEval = curr.evaluatorResults.find((e) => !e.passed)
      const reason = failedEval?.details || failedEval?.error || `Score decreased from ${base.overallScore} to ${curr.overallScore}`
      regressedCases.push({
        testCaseId: curr.testCaseId,
        testCaseName: curr.testCaseName,
        baselineScore: base.overallScore,
        currentScore: curr.overallScore,
        deltaScore: scoreDiff,
        reason,
      })
    } else if (scoreDiff > 0.05) {
      // Improved
      improvedCases.push({
        testCaseId: curr.testCaseId,
        testCaseName: curr.testCaseName,
        baselineScore: base.overallScore,
        currentScore: curr.overallScore,
        deltaScore: scoreDiff,
      })
    } else {
      unchangedCount++
    }
  }

  const violations: string[] = []

  // Check thresholds
  const maxPassDrop = thresholds.maxPassRateDrop ?? DEFAULT_REGRESSION_THRESHOLDS.maxPassRateDrop!
  if (passRateDelta < -maxPassDrop) {
    violations.push(
      `Pass rate dropped by ${Math.abs(passRateDelta * 100).toFixed(1)}% (allowed limit: ${(
        maxPassDrop * 100
      ).toFixed(1)}%)`
    )
  }

  const maxScoreDrop = thresholds.maxScoreDrop ?? DEFAULT_REGRESSION_THRESHOLDS.maxScoreDrop!
  if (averageScoreDelta < -maxScoreDrop) {
    violations.push(
      `Average score dropped by ${Math.abs(averageScoreDelta).toFixed(3)} (allowed limit: ${maxScoreDrop.toFixed(
        3
      )})`
    )
  }

  const maxLatPercent =
    thresholds.maxLatencyIncreasePercent ?? DEFAULT_REGRESSION_THRESHOLDS.maxLatencyIncreasePercent!
  if (latencyPercentDelta > maxLatPercent) {
    violations.push(
      `Average latency increased by ${latencyPercentDelta.toFixed(1)}% (allowed limit: ${maxLatPercent}%)`
    )
  }

  if (thresholds.maxCostIncreasePercent !== undefined && costDeltaUsd !== undefined && baseline.totalCostUsd && baseline.totalCostUsd > 0) {
    const costPercentDelta = ((current.totalCostUsd! - baseline.totalCostUsd) / baseline.totalCostUsd) * 100
    if (costPercentDelta > thresholds.maxCostIncreasePercent) {
      violations.push(
        `Total cost increased by ${costPercentDelta.toFixed(1)}% (allowed limit: ${thresholds.maxCostIncreasePercent}%)`
      )
    }
  }

  if (thresholds.allowZeroRegressions && regressedCases.length > 0) {
    violations.push(
      `Zero regression policy violated: ${regressedCases.length} individual test case(s) regressed.`
    )
  }

  return {
    baselineRunId: baseline.runId,
    currentRunId: current.runId,
    passRateDelta,
    averageScoreDelta,
    latencyDeltaMs,
    latencyPercentDelta,
    costDeltaUsd,
    regressedCases,
    improvedCases,
    unchangedCount,
    regressionDetected: violations.length > 0,
    violations,
  }
}
