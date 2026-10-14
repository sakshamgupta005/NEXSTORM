/**
 * Machine-Readable & Human-Readable AI Evaluation Reporters
 * 
 * Safety & Privacy:
 * - Automatically scrubs API keys, bearer tokens, and credentials from reports
 * - Generates clean Markdown tables for pull requests / hackathon logs
 * - Generates machine-readable JSON reports for CI quality gates
 */

import type { BaselineComparison, EvalReport } from './types'

const SENSITIVE_PATTERNS = [
  /(?:sk-[a-zA-Z0-9_-]{20,})/g, // OpenAI style keys
  /(?:AIza[0-9A-Za-z-_]{35})/g, // Google API keys
  /(?:gsk_[a-zA-Z0-9]{20,})/g, // Groq API keys
  /(?:bearer\s+[a-zA-Z0-9_\-\.]{15,})/gi, // Bearer tokens
  /(?:password\s*[:=]\s*["']?[^\s"'\n]{4,})/gi, // Password patterns
  /(?:secret\s*[:=]\s*["']?[^\s"'\n]{4,})/gi, // Secret patterns
  /(?:supabase_service_role_key\s*[:=]\s*["']?[^\s"'\n]+)/gi,
]

/**
 * Redacts known sensitive patterns and credentials
 */
export function redactSensitiveData<T>(input: T): T {
  if (typeof input === 'string') {
    let sanitized: string = input
    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED_SECRET]')
    }
    return sanitized as unknown as T
  }

  if (Array.isArray(input)) {
    return input.map((item) => redactSensitiveData(item)) as unknown as T
  }

  if (input !== null && typeof input === 'object') {
    const output: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      const lowerKey = k.toLowerCase()
      if (
        lowerKey.includes('key') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('auth') ||
        lowerKey.includes('password')
      ) {
        output[k] = '[REDACTED_SECRET]'
      } else {
        output[k] = redactSensitiveData(v)
      }
    }
    return output as unknown as T
  }

  return input
}

/**
 * Formats a clean Markdown summary report for review
 */
export function formatMarkdownReport(
  report: EvalReport,
  comparison?: BaselineComparison
): string {
  const sanitizedReport = redactSensitiveData(report)
  const passPercent = (sanitizedReport.passRate * 100).toFixed(1)
  const scorePercent = (sanitizedReport.averageScore * 100).toFixed(1)

  const lines: string[] = []

  lines.push(`# AI Evaluation Report: ${sanitizedReport.datasetId} (v${sanitizedReport.datasetVersion})`)
  lines.push(`**Run ID:** \`${sanitizedReport.runId}\` | **Model:** \`${sanitizedReport.provider}/${sanitizedReport.model}\` | **Date:** ${sanitizedReport.timestamp}`)
  lines.push('')

  if (comparison) {
    if (comparison.regressionDetected) {
      lines.push('### ⚠️ REGRESSION DETECTED')
      for (const v of comparison.violations) {
        lines.push(`- ❌ **Violation:** ${v}`)
      }
    } else {
      lines.push('### ✅ NO REGRESSIONS DETECTED (All thresholds satisfied)')
    }
    lines.push('')
  }

  // High-Level Metrics
  lines.push('## Executive Metrics')
  lines.push('| Metric | Value | Baseline Delta |')
  lines.push('| :--- | :--- | :--- |')
  lines.push(
    `| Pass Rate | **${passPercent}%** (${sanitizedReport.passedCases}/${sanitizedReport.totalCases}) | ${
      comparison
        ? `${comparison.passRateDelta >= 0 ? '+' : ''}${(comparison.passRateDelta * 100).toFixed(1)}%`
        : 'N/A'
    } |`
  )
  lines.push(
    `| Average Score | **${scorePercent}%** | ${
      comparison
        ? `${comparison.averageScoreDelta >= 0 ? '+' : ''}${(comparison.averageScoreDelta * 100).toFixed(1)}%`
        : 'N/A'
    } |`
  )
  lines.push(
    `| Avg Latency | **${sanitizedReport.averageLatencyMs}ms** | ${
      comparison
        ? `${comparison.latencyDeltaMs >= 0 ? '+' : ''}${comparison.latencyDeltaMs}ms (${
            comparison.latencyPercentDelta >= 0 ? '+' : ''
          }${comparison.latencyPercentDelta}%)`
        : 'N/A'
    } |`
  )
  lines.push(
    `| Total Tokens | ${sanitizedReport.totalTokens ?? 'N/A (untracked)'} | - |`
  )
  lines.push(
    `| Estimated Cost | ${
      sanitizedReport.totalCostUsd !== undefined ? `$${sanitizedReport.totalCostUsd.toFixed(6)}` : 'N/A'
    } | ${comparison?.costDeltaUsd !== undefined ? `$${comparison.costDeltaUsd.toFixed(6)}` : 'N/A'} |`
  )
  lines.push('')

  // Category Breakdown
  lines.push('## Category Breakdown')
  lines.push('| Category | Cases | Passed | Pass Rate | Avg Score |')
  lines.push('| :--- | :--- | :--- | :--- | :--- |')
  for (const [cat, sum] of Object.entries(sanitizedReport.categoryBreakdown)) {
    lines.push(
      `| \`${cat}\` | ${sum.total} | ${sum.passed} | ${(sum.passRate * 100).toFixed(1)}% | ${(
        sum.avgScore * 100
      ).toFixed(1)}% |`
    )
  }
  lines.push('')

  // Regressions section if present
  if (comparison && comparison.regressedCases.length > 0) {
    lines.push('## ⚠️ Regressed Test Cases')
    lines.push('| Case Name | Baseline Score | Current Score | Reason |')
    lines.push('| :--- | :--- | :--- | :--- |')
    for (const r of comparison.regressedCases) {
      lines.push(
        `| ${r.testCaseName} | ${(r.baselineScore * 100).toFixed(0)}% | **${(
          r.currentScore * 100
        ).toFixed(0)}%** | ${r.reason} |`
      )
    }
    lines.push('')
  }

  // Detailed Test Case Results
  lines.push('## Test Case Results')
  lines.push('| Status | Case Name | Category | Score | Latency | Details |')
  lines.push('| :--- | :--- | :--- | :--- | :--- | :--- |')
  for (const r of sanitizedReport.results) {
    const statusIcon = r.passed ? '✅ Pass' : '❌ Fail'
    const scoreStr = `${(r.overallScore * 100).toFixed(0)}%`
    const details = r.evaluatorResults.map((e) => `[${e.evaluatorType}]: ${e.details || e.error || 'ok'}`).join(' ')
    const safeDetails = details.replace(/\|/g, '\\|').slice(0, 80)
    lines.push(
      `| ${statusIcon} | ${r.testCaseName} | \`${r.category}\` | ${scoreStr} | ${r.execution.latencyMs}ms | ${safeDetails}... |`
    )
  }

  lines.push('')
  lines.push('> *Heuristic evaluation scores provide directional signals. Human verification is recommended for safety and factual correctness.*')

  return lines.join('\n')
}

/**
 * Formats a sanitized JSON evaluation report
 */
export function formatJsonReport(
  report: EvalReport,
  comparison?: BaselineComparison,
  options: { redact?: boolean } = { redact: true }
): string {
  const data = {
    report: options.redact ? redactSensitiveData(report) : report,
    comparison: comparison ? (options.redact ? redactSensitiveData(comparison) : comparison) : undefined,
  }
  return JSON.stringify(data, null, 2)
}
