/**
 * AI Evaluation & Benchmarking Toolkit - Type Definitions
 * 
 * References:
 * - promptfoo (https://github.com/promptfoo/promptfoo): Assertions, test matrix, comparison reports
 * - DeepEval (https://github.com/confident-ai/deepeval): Metric evaluators, threshold gating
 * - Ragas (https://github.com/explodinggradients/ragas): Context groundedness, retrieval evaluation
 * - Langfuse (https://github.com/langfuse/langfuse): Latency, token tracking, baseline comparisons
 */

import { z } from 'zod'

export type EvaluatorType =
  | 'exact-match'
  | 'normalized-text'
  | 'keyword'
  | 'json-schema'
  | 'tool-call'
  | 'citation-groundedness'
  | 'rubric'
  | 'prompt-injection-safety'
  | 'latency'

export interface EvaluatorConfig {
  type: EvaluatorType
  weight?: number // default 1.0
  threshold?: number // score cutoff (0.0 - 1.0 or ms limit)
  params?: Record<string, unknown>
}

export interface EvalInput {
  prompt: string
  system?: string
  contextDocuments?: string[]
  variables?: Record<string, string>
  tools?: Array<{
    name: string
    description?: string
    parameters?: unknown
  }>
}

export interface EvalExpected {
  exact?: string
  normalized?: string
  containsKeywords?: string[]
  forbiddenKeywords?: string[]
  jsonSchema?: z.ZodTypeAny | Record<string, unknown>
  expectedToolCall?: {
    name: string
    args?: Record<string, unknown>
  }
  expectedCitations?: boolean
  rubric?: {
    criteria: string
    requiredChecks?: string[]
    maxScore?: number
  }
}

export interface EvalTestCase {
  id: string
  name: string
  description?: string
  category: 'qa' | 'classification' | 'extraction' | 'rag' | 'tools' | 'safety' | 'reasoning' | string
  input: EvalInput
  expected?: EvalExpected
  evaluators: EvaluatorConfig[]
  metadata?: Record<string, unknown>
}

export interface EvalDataset {
  id: string
  name: string
  version: string
  description?: string
  createdAt?: string
  testCases: EvalTestCase[]
  metadata?: Record<string, unknown>
}

export interface EvaluatorResult {
  evaluatorType: EvaluatorType
  passed: boolean
  score: number // 0.0 - 1.0
  details?: string
  error?: string
  metadata?: Record<string, unknown>
}

export interface ModelExecutionMetadata {
  latencyMs: number
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  costUsd?: number
  model: string
  provider: string
}

export interface TestCaseRunResult {
  testCaseId: string
  testCaseName: string
  category: string
  passed: boolean
  overallScore: number // weighted composite score 0.0 - 1.0
  evaluatorResults: EvaluatorResult[]
  output: {
    text: string
    toolCalls?: Array<{ name: string; args: unknown }>
    error?: string
  }
  execution: ModelExecutionMetadata
}

export interface CategorySummary {
  total: number
  passed: number
  passRate: number
  avgScore: number
}

export interface EvalReport {
  runId: string
  datasetId: string
  datasetVersion: string
  provider: string
  model: string
  promptVersion?: string
  timestamp: string
  totalCases: number
  passedCases: number
  failedCases: number
  passRate: number // 0.0 - 1.0
  averageScore: number // 0.0 - 1.0
  totalLatencyMs: number
  averageLatencyMs: number
  totalTokens?: number
  totalCostUsd?: number
  results: TestCaseRunResult[]
  categoryBreakdown: Record<string, CategorySummary>
  metadata?: Record<string, unknown>
}

export interface RegressedCase {
  testCaseId: string
  testCaseName: string
  baselineScore: number
  currentScore: number
  deltaScore: number
  reason: string
}

export interface ImprovedCase {
  testCaseId: string
  testCaseName: string
  baselineScore: number
  currentScore: number
  deltaScore: number
}

export interface RegressionThresholds {
  /** Maximum allowed drop in overall pass rate (e.g. 0.05 for 5% drop) */
  maxPassRateDrop?: number
  /** Maximum allowed drop in average score (e.g. 0.05) */
  maxScoreDrop?: number
  /** Maximum allowed latency increase percentage (e.g. 20 for 20%) */
  maxLatencyIncreasePercent?: number
  /** Maximum allowed cost increase percentage (e.g. 15 for 15%) */
  maxCostIncreasePercent?: number
  /** Disallow any individual test case score regression */
  allowZeroRegressions?: boolean
}

export interface BaselineComparison {
  baselineRunId: string
  currentRunId: string
  passRateDelta: number // current - baseline
  averageScoreDelta: number
  latencyDeltaMs: number
  latencyPercentDelta: number
  costDeltaUsd?: number
  regressedCases: RegressedCase[]
  improvedCases: ImprovedCase[]
  unchangedCount: number
  regressionDetected: boolean
  violations: string[]
}

export type AIProviderRunner = (
  input: EvalInput,
  options?: {
    model?: string
    provider?: string
    timeoutMs?: number
    signal?: AbortSignal
  }
) => Promise<{
  text: string
  toolCalls?: Array<{ name: string; args: unknown }>
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
  latencyMs: number
  error?: string
}>
