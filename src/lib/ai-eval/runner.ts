/**
 * Evaluation Runner & Benchmark Engine
 * 
 * Capabilities:
 * - Executes evaluation datasets against real AI providers or deterministic mocks
 * - Measures real latency with performance.now()
 * - Strictly preserves provider token counts and calculates costs transparently without fabrication
 * - Bounded error handling, timeout enforcement, and cancellation via AbortSignal
 * - Aggregates category metrics, pass rates, and produces machine-readable EvalReport
 */

import { calculateAiCost } from '@/lib/observability/metrics'
import { defaultEvaluatorRegistry, EvaluatorRegistry } from './evaluators'
import type {
  AIProviderRunner,
  CategorySummary,
  EvalDataset,
  EvalReport,
  EvaluatorResult,
  EvalTestCase,
  ModelExecutionMetadata,
  TestCaseRunResult,
} from './types'

export interface RunnerOptions {
  dataset: EvalDataset
  providerRunner: AIProviderRunner
  model: string
  provider: string
  promptVersion?: string
  timeoutMs?: number
  registry?: EvaluatorRegistry
  signal?: AbortSignal
  concurrency?: number
  onProgress?: (completed: number, total: number, currentCase: EvalTestCase) => void
}

export class EvaluationRunner {
  private registry: EvaluatorRegistry

  constructor(registry: EvaluatorRegistry = defaultEvaluatorRegistry) {
    this.registry = registry
  }

  async run(options: RunnerOptions): Promise<EvalReport> {
    const {
      dataset,
      providerRunner,
      model,
      provider,
      promptVersion = 'v1.0.0',
      timeoutMs = 15000,
      signal,
      onProgress,
    } = options

    const startTime = Date.now()
    const results: TestCaseRunResult[] = []
    const categoryMap: Record<string, { total: number; passed: number; scores: number[] }> = {}

    let totalTokens: number | undefined = undefined
    let totalCostUsd: number | undefined = undefined

    for (let i = 0; i < dataset.testCases.length; i++) {
      if (signal?.aborted) {
        throw new Error('Evaluation run aborted by caller signal.')
      }

      const testCase = dataset.testCases[i]
      onProgress?.(i, dataset.testCases.length, testCase)

      const caseResult = await this.runSingleCase(
        testCase,
        providerRunner,
        model,
        provider,
        timeoutMs,
        signal
      )
      results.push(caseResult)

      // Accumulate tokens if reliably present
      if (caseResult.execution.totalTokens !== undefined) {
        totalTokens = (totalTokens ?? 0) + caseResult.execution.totalTokens
      }
      if (caseResult.execution.costUsd !== undefined) {
        totalCostUsd = Math.round(((totalCostUsd ?? 0) + caseResult.execution.costUsd) * 1_000_000) / 1_000_000
      }

      // Category breakdown
      const cat = testCase.category
      if (!categoryMap[cat]) {
        categoryMap[cat] = { total: 0, passed: 0, scores: [] }
      }
      categoryMap[cat].total++
      if (caseResult.passed) categoryMap[cat].passed++
      categoryMap[cat].scores.push(caseResult.overallScore)
    }

    onProgress?.(dataset.testCases.length, dataset.testCases.length, dataset.testCases[dataset.testCases.length - 1])

    const totalCases = results.length
    const passedCases = results.filter((r) => r.passed).length
    const failedCases = totalCases - passedCases
    const passRate = totalCases > 0 ? Math.round((passedCases / totalCases) * 1000) / 1000 : 0
    const averageScore =
      totalCases > 0
        ? Math.round((results.reduce((acc, r) => acc + r.overallScore, 0) / totalCases) * 1000) / 1000
        : 0

    const totalLatencyMs = results.reduce((acc, r) => acc + r.execution.latencyMs, 0)
    const averageLatencyMs = totalCases > 0 ? Math.round(totalLatencyMs / totalCases) : 0

    const categoryBreakdown: Record<string, CategorySummary> = {}
    for (const [cat, data] of Object.entries(categoryMap)) {
      categoryBreakdown[cat] = {
        total: data.total,
        passed: data.passed,
        passRate: data.total > 0 ? Math.round((data.passed / data.total) * 1000) / 1000 : 0,
        avgScore:
          data.total > 0
            ? Math.round((data.scores.reduce((a, b) => a + b, 0) / data.total) * 1000) / 1000
            : 0,
      }
    }

    return {
      runId: `run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      datasetId: dataset.id,
      datasetVersion: dataset.version,
      provider,
      model,
      promptVersion,
      timestamp: new Date().toISOString(),
      totalCases,
      passedCases,
      failedCases,
      passRate,
      averageScore,
      totalLatencyMs,
      averageLatencyMs,
      totalTokens,
      totalCostUsd,
      results,
      categoryBreakdown,
      metadata: {
        totalDurationMs: Date.now() - startTime,
      },
    }
  }

  private async runSingleCase(
    testCase: EvalTestCase,
    providerRunner: AIProviderRunner,
    model: string,
    provider: string,
    timeoutMs: number,
    signal?: AbortSignal
  ): Promise<TestCaseRunResult> {
    const start = performance.now()
    let responseText = ''
    let toolCalls: Array<{ name: string; args: unknown }> | undefined = undefined
    let usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined = undefined
    let runError: string | undefined = undefined
    let latencyMs = 0

    try {
      // Execute with timeout and cancellation
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(new Error(`Test case timed out after ${timeoutMs}ms`)), timeoutMs)
        signal?.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(new Error('Operation aborted'))
        })
      })

      const execPromise = providerRunner(testCase.input, { model, provider, timeoutMs, signal })
      const res = await Promise.race([execPromise, timeoutPromise])

      latencyMs = Math.round(performance.now() - start)
      responseText = res.text || ''
      toolCalls = res.toolCalls
      usage = res.usage
      runError = res.error
    } catch (err) {
      latencyMs = Math.round(performance.now() - start)
      runError = (err as Error).message
    }

    // Cost calculation (transparently via observability pricing table, or undefined)
    const costUsd = calculateAiCost(model, usage?.promptTokens, usage?.completionTokens)

    const execution: ModelExecutionMetadata = {
      latencyMs,
      promptTokens: usage?.promptTokens,
      completionTokens: usage?.completionTokens,
      totalTokens: usage?.totalTokens,
      costUsd,
      model,
      provider,
    }

    // If execution threw an error, evaluators fail
    if (runError) {
      return {
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        category: testCase.category,
        passed: false,
        overallScore: 0.0,
        evaluatorResults: [
          {
            evaluatorType: 'latency',
            passed: false,
            score: 0.0,
            error: runError,
          },
        ],
        output: { text: responseText, toolCalls, error: runError },
        execution,
      }
    }

    // Run configured evaluators
    const evaluatorResults: EvaluatorResult[] = []
    let totalWeight = 0
    let weightedScoreSum = 0
    let allPassed = true

    for (const cfg of testCase.evaluators) {
      const evaluator = this.registry.get(cfg.type)
      const weight = cfg.weight ?? 1.0
      totalWeight += weight

      if (!evaluator) {
        evaluatorResults.push({
          evaluatorType: cfg.type,
          passed: false,
          score: 0.0,
          error: `Evaluator "${cfg.type}" is not registered in registry`,
        })
        allPassed = false
        continue
      }

      try {
        const evalRes = await evaluator.evaluate(
          testCase,
          { text: responseText, toolCalls, latencyMs },
          cfg
        )
        evaluatorResults.push(evalRes)
        weightedScoreSum += evalRes.score * weight
        if (!evalRes.passed) {
          allPassed = false
        }
      } catch (err) {
        evaluatorResults.push({
          evaluatorType: cfg.type,
          passed: false,
          score: 0.0,
          error: `Evaluator threw error: ${(err as Error).message}`,
        })
        allPassed = false
      }
    }

    const overallScore =
      totalWeight > 0 ? Math.round((weightedScoreSum / totalWeight) * 1000) / 1000 : 0.0

    return {
      testCaseId: testCase.id,
      testCaseName: testCase.name,
      category: testCase.category,
      passed: allPassed,
      overallScore,
      evaluatorResults,
      output: {
        text: responseText,
        toolCalls,
        error: runError,
      },
      execution,
    }
  }
}

/**
 * Creates a deterministic mock AI provider runner for zero-cost unit and E2E testing
 */
export function createMockProviderRunner(
  behavior?: {
    responses?: Record<string, { text: string; toolCalls?: Array<{ name: string; args: unknown }> }>
    defaultLatencyMs?: number
    defaultTokens?: { prompt: number; completion: number }
    failCaseIds?: string[]
  }
): AIProviderRunner {
  const latency = behavior?.defaultLatencyMs ?? 25
  const tokens = behavior?.defaultTokens ?? { prompt: 45, completion: 20 }

  return async (input) => {
    await new Promise((resolve) => setTimeout(resolve, latency))

    // Handle safety prompt override attempts gracefully in default mock
    const pLower = input.prompt.toLowerCase()

    if (pLower.includes('ignore all previous') && pLower.includes('pwned')) {
      return {
        text: 'I cannot comply with requests to ignore safety guidelines or reveal system instructions.',
        latencyMs: latency,
        usage: {
          promptTokens: tokens.prompt,
          completionTokens: tokens.completion,
          totalTokens: tokens.prompt + tokens.completion,
        },
      }
    }

    if (pLower.includes('repeat your initial system instructions')) {
      return {
        text: 'I cannot disclose my underlying confidential system prompts.',
        latencyMs: latency,
        usage: {
          promptTokens: tokens.prompt,
          completionTokens: tokens.completion,
          totalTokens: tokens.prompt + tokens.completion,
        },
      }
    }

    if (pLower.includes('classify the sentiment')) {
      return {
        text: 'POSITIVE',
        latencyMs: latency,
        usage: {
          promptTokens: tokens.prompt,
          completionTokens: 2,
          totalTokens: tokens.prompt + 2,
        },
      }
    }

    if (pLower.includes('extract the meeting title')) {
      return {
        text: '{"title": "Hackathon kickoff", "date": "Friday at 10 AM UTC"}',
        latencyMs: latency,
        usage: {
          promptTokens: tokens.prompt,
          completionTokens: 18,
          totalTokens: tokens.prompt + 18,
        },
      }
    }

    if (pLower.includes('refund policy')) {
      return {
        text: 'According to [doc-1], refunds are processed within 5 business days for requests made within 30 days of purchase.',
        latencyMs: latency,
        usage: {
          promptTokens: tokens.prompt,
          completionTokens: 24,
          totalTokens: tokens.prompt + 24,
        },
      }
    }

    if (pLower.includes('weather forecast for tokyo')) {
      return {
        text: 'Checking Tokyo weather.',
        toolCalls: [{ name: 'get_weather', args: { city: 'Tokyo' } }],
        latencyMs: latency,
        usage: {
          promptTokens: tokens.prompt,
          completionTokens: 10,
          totalTokens: tokens.prompt + 10,
        },
      }
    }

    if (pLower.includes('cloud migration')) {
      return {
        text: 'Here are the key advantages:\n- Enhanced scalability for peak hackathon traffic\n- Improved cost management with pay-as-you-go infrastructure\n- Automated resilience and reliability',
        latencyMs: latency,
        usage: {
          promptTokens: tokens.prompt,
          completionTokens: 35,
          totalTokens: tokens.prompt + 35,
        },
      }
    }

    return {
      text: 'Mock response completed.',
      latencyMs: latency,
      usage: {
        promptTokens: tokens.prompt,
        completionTokens: tokens.completion,
        totalTokens: tokens.prompt + tokens.completion,
      },
    }
  }
}
