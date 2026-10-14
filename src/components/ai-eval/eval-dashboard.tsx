'use client'

import * as React from 'react'
import {
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  Download,
  Copy,
  ChevronDown,
  ChevronRight,
  FileCheck,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DEFAULT_BENCHMARK_DATASET,
  EvaluationRunner,
  createMockProviderRunner,
  compareWithBaseline,
  formatMarkdownReport,
  formatJsonReport,
  type EvalReport,
  type BaselineComparison,
} from '@/lib/ai-eval'

export function EvalDashboard() {
  const [isRunning, setIsRunning] = React.useState(false)
  const [progress, setProgress] = React.useState({ completed: 0, total: 0 })
  const [report, setReport] = React.useState<EvalReport | null>(null)
  const [baselineReport, setBaselineReport] = React.useState<EvalReport | null>(null)
  const [comparison, setComparison] = React.useState<BaselineComparison | null>(null)
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all')
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'passed' | 'failed'>('all')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [expandedCaseId, setExpandedCaseId] = React.useState<string | null>(null)
  const [simulationScenario, setSimulationScenario] = React.useState<'optimal' | 'regression'>('optimal')
  const [copyFeedback, setCopyFeedback] = React.useState<string | null>(null)

  // Run the evaluation suite
  const handleRunEvaluation = async (scenario = simulationScenario) => {
    setIsRunning(true)
    setProgress({ completed: 0, total: DEFAULT_BENCHMARK_DATASET.testCases.length })

    try {
      const runner = new EvaluationRunner()

      // Configure mock provider runner according to scenario
      const mockRunner = createMockProviderRunner({
        defaultLatencyMs: scenario === 'regression' ? 20 : 10,
        defaultTokens: { prompt: 50, completion: 25 },
        failCaseIds: scenario === 'regression' ? ['case-extraction-02', 'case-rag-grounding-03'] : [],
      })

      // If in regression mode, inject malformed responses for specific cases
      const activeRunner = scenario === 'regression'
        ? async (input: Parameters<typeof mockRunner>[0], opts: Parameters<typeof mockRunner>[1]) => {
            if (input.prompt.includes('extract the meeting title')) {
              // Return malformed JSON to trigger schema evaluation failure
              return {
                text: 'Meeting on Friday (no JSON returned)',
                latencyMs: 120,
                usage: { promptTokens: 60, completionTokens: 10, totalTokens: 70 },
              }
            }
            if (input.prompt.includes('refund policy')) {
              // Return ungrounded hallucination with missing citation
              return {
                text: 'Refunds are issued instantly with zero documentation needed at any time.',
                latencyMs: 150,
                usage: { promptTokens: 55, completionTokens: 15, totalTokens: 70 },
              }
            }
            return mockRunner(input, opts)
          }
        : mockRunner

      const resultReport = await runner.run({
        dataset: DEFAULT_BENCHMARK_DATASET,
        providerRunner: activeRunner,
        model: scenario === 'optimal' ? 'mock-gpt-4o' : 'mock-gpt-4o-legacy',
        provider: 'mock',
        promptVersion: scenario === 'optimal' ? 'v2.1.0' : 'v2.0.0-draft',
        onProgress: (completed, total) => {
          setProgress({ completed, total })
        },
      })

      setReport(resultReport)

      // Compare against baseline if available, or initialize baseline on first optimal run
      if (baselineReport) {
        const comp = compareWithBaseline(resultReport, baselineReport)
        setComparison(comp)
      } else if (scenario === 'optimal') {
        setBaselineReport(resultReport)
      }
    } catch (err) {
      console.error('Failed to run evaluation suite:', err)
    } finally {
      setIsRunning(false)
    }
  }

  // Pre-seed optimal baseline on initial load
  React.useEffect(() => {
    const timer = setTimeout(() => {
      void handleRunEvaluation('optimal')
    }, 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCopyMarkdown = () => {
    if (!report) return
    const md = formatMarkdownReport(report, comparison ?? undefined)
    void navigator.clipboard.writeText(md)
    setCopyFeedback('Markdown copied to clipboard!')
    setTimeout(() => setCopyFeedback(null), 3000)
  }

  const handleCopyJson = () => {
    if (!report) return
    const json = formatJsonReport(report, comparison ?? undefined)
    void navigator.clipboard.writeText(json)
    setCopyFeedback('Sanitized JSON copied to clipboard!')
    setTimeout(() => setCopyFeedback(null), 3000)
  }

  // Filter test cases
  const filteredResults = React.useMemo(() => {
    if (!report) return []
    return report.results.filter((res) => {
      if (selectedCategory !== 'all' && res.category !== selectedCategory) return false
      if (statusFilter === 'passed' && !res.passed) return false
      if (statusFilter === 'failed' && res.passed) return false
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchesName = res.testCaseName.toLowerCase().includes(query)
        const matchesId = res.testCaseId.toLowerCase().includes(query)
        if (!matchesName && !matchesId) return false
      }
      return true
    })
  }, [report, selectedCategory, statusFilter, searchQuery])

  const categories = React.useMemo(() => {
    if (!report) return []
    return Object.keys(report.categoryBreakdown)
  }, [report])

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <Card className="border-indigo-100 dark:border-indigo-950/50 bg-gradient-to-r from-indigo-50/50 via-white to-sky-50/40 dark:from-indigo-950/20 dark:via-slate-900 dark:to-sky-950/10">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-indigo-600 text-white shadow-sm">
                  <Sparkles className="h-5 w-5" />
                </span>
                <CardTitle className="text-xl sm:text-2xl font-bold">
                  AI Evaluation & Benchmarking Toolkit
                </CardTitle>
                <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200">
                  Dataset v{DEFAULT_BENCHMARK_DATASET.version}
                </Badge>
              </div>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Measure AI accuracy, RAG context grounding, schema conformity, and detect regressions deterministically without external model costs.
              </CardDescription>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Simulation Scenario"
                value={simulationScenario}
                onChange={(e) => setSimulationScenario(e.target.value as 'optimal' | 'regression')}
                className="text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 font-medium text-slate-700 dark:text-slate-200"
              >
                <option value="optimal">Scenario: Optimal Suite (100% Pass)</option>
                <option value="regression">Scenario: Prompt Regression (Schema & RAG Fail)</option>
              </select>

              <Button
                variant="default"
                size="sm"
                onClick={() => void handleRunEvaluation(simulationScenario)}
                disabled={isRunning}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isRunning ? (
                  <>
                    <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
                    Evaluating ({progress.completed}/{progress.total})...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4 fill-white" />
                    Run Benchmark
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Regression Alert Banner if applicable */}
      {comparison && comparison.regressionDetected && (
        <div className="rounded-lg border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-rose-900 dark:text-rose-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-rose-700 dark:text-rose-300">
                AI Regression Detected against Baseline ({comparison.violations.length} violations)
              </p>
              <ul className="list-disc pl-5 space-y-0.5 text-xs text-rose-800 dark:text-rose-300/90">
                {comparison.violations.map((v, idx) => (
                  <li key={idx}>{v}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Metric Overview Cards */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Pass Rate</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {(report.passRate * 100).toFixed(1)}%
                </span>
                <span className="text-xs text-slate-500">
                  ({report.passedCases}/{report.totalCases})
                </span>
              </div>
              {comparison && (
                <div className="mt-1 text-xs">
                  <span
                    className={
                      comparison.passRateDelta < 0
                        ? 'text-rose-600 font-medium'
                        : 'text-emerald-600 font-medium'
                    }
                  >
                    {comparison.passRateDelta >= 0 ? '+' : ''}
                    {(comparison.passRateDelta * 100).toFixed(1)}% vs baseline
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Average Score</span>
                <FileCheck className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {(report.averageScore * 100).toFixed(1)}%
                </span>
              </div>
              {comparison && (
                <div className="mt-1 text-xs">
                  <span
                    className={
                      comparison.averageScoreDelta < 0
                        ? 'text-rose-600 font-medium'
                        : 'text-emerald-600 font-medium'
                    }
                  >
                    {comparison.averageScoreDelta >= 0 ? '+' : ''}
                    {(comparison.averageScoreDelta * 100).toFixed(1)}% vs baseline
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Average Latency</span>
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {report.averageLatencyMs}ms
                </span>
              </div>
              {comparison && (
                <div className="mt-1 text-xs">
                  <span
                    className={
                      comparison.latencyDeltaMs > 50
                        ? 'text-amber-600 font-medium'
                        : 'text-slate-500'
                    }
                  >
                    {comparison.latencyDeltaMs >= 0 ? '+' : ''}
                    {comparison.latencyDeltaMs}ms vs baseline
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Estimated Cost</span>
                <DollarSign className="h-4 w-4 text-sky-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {report.totalCostUsd !== undefined ? `$${report.totalCostUsd.toFixed(5)}` : '$0.00'}
                </span>
                <span className="text-xs text-slate-500">
                  {report.totalTokens ?? 0} tokens
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Deterministic mock pricing
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter and Export Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium">Category:</span>
            <select
              aria-label="Filter by Category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              aria-label="Filter by Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'passed' | 'failed')}
              className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Cases</option>
              <option value="passed">Passed Only</option>
              <option value="failed">Failed Only</option>
            </select>
          </div>

          {/* Search Input */}
          <input
            type="text"
            placeholder="Search test cases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 w-44 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          {copyFeedback && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium animate-pulse">
              {copyFeedback}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyMarkdown}
            disabled={!report}
            className="text-xs"
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Copy Markdown
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyJson}
            disabled={!report}
            className="text-xs"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Copy JSON
          </Button>
        </div>
      </div>

      {/* Test Cases Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Evaluation Test Cases ({filteredResults.length} / {report?.totalCases ?? 0})
            </CardTitle>
            <div className="text-xs text-slate-500">
              Provider: <span className="font-mono text-slate-700 dark:text-slate-300">{report?.provider}/{report?.model}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredResults.map((result) => {
              const isExpanded = expandedCaseId === result.testCaseId
              return (
                <div key={result.testCaseId} className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => setExpandedCaseId(isExpanded ? null : result.testCaseId)}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        aria-label="Toggle details"
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>

                      {result.passed ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-rose-500 shrink-0" />
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {result.testCaseName}
                          </span>
                          <Badge variant="secondary" className="text-[10px] uppercase font-mono px-1.5 py-0">
                            {result.category}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          ID: {result.testCaseId}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-right">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {(result.overallScore * 100).toFixed(0)}%
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          {result.execution.latencyMs}ms
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-11 pb-4 pt-1 space-y-3 bg-slate-50/70 dark:bg-slate-900/70 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Model Output:</span>
                        <pre className="mt-1 p-2.5 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                          {result.output.text || '(empty response)'}
                        </pre>
                      </div>

                      {result.output.toolCalls && result.output.toolCalls.length > 0 && (
                        <div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Tool Calls:</span>
                          <pre className="mt-1 p-2 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-800 dark:text-slate-200">
                            {JSON.stringify(result.output.toolCalls, null, 2)}
                          </pre>
                        </div>
                      )}

                      <div>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Evaluator Breakdown:</span>
                        <div className="mt-1.5 space-y-1.5">
                          {result.evaluatorResults.map((ev, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-2 p-2 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                            >
                              <Badge
                                variant={ev.passed ? 'default' : 'danger'}
                                className="text-[10px] shrink-0 font-mono"
                              >
                                {ev.evaluatorType}
                              </Badge>
                              <div className="flex-1 text-[11px] text-slate-600 dark:text-slate-400">
                                {ev.details || ev.error || 'Check completed'}
                              </div>
                              <span className="text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300">
                                {(ev.score * 100).toFixed(0)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
