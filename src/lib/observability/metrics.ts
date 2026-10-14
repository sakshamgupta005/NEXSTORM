/**
 * Application Metrics & Usage Tracking Engine
 * 
 * Reference: Prometheus client (https://github.com/siimon/prom-client)
 * 
 * Capabilities:
 * - Low-cardinality label validation to prevent memory leaks and TSDB degradation
 * - Core primitives: Counter, Gauge, Histogram (percentiles p50, p90, p99)
 * - Grounded AI token usage and transparent cost estimation (strictly when pricing is configured)
 * - Zero external collector required: runs 100% in-memory with snapshot queries
 */

import type {
  MetricLabels,
  HistogramSnapshot,
  AiUsageMetadata,
} from './types'

const HIGH_CARDINALITY_KEYS = new Set([
  'userid',
  'user_id',
  'url',
  'path',
  'query',
  'prompt',
  'email',
  'token',
  'secret',
  'requestid',
  'traceid',
])

export function validateLabels(labels?: MetricLabels): MetricLabels {
  if (!labels) return {}

  const sanitized: MetricLabels = {}
  const keys = Object.keys(labels)

  if (keys.length > 5) {
    throw new Error(`Metric label limit exceeded: maximum 5 labels per metric, received ${keys.length}`)
  }

  for (const [k, v] of Object.entries(labels)) {
    const lowerKey = k.toLowerCase().replace(/[-_]/g, '')
    if (HIGH_CARDINALITY_KEYS.has(lowerKey)) {
      throw new Error(
        `High-cardinality metric label rejected: '${k}'. Unbounded values (user IDs, URLs, queries) must not be metric labels.`
      )
    }

    // Limit label value length to 64 chars
    sanitized[k] = String(v).slice(0, 64)
  }

  return sanitized
}

function serializeLabels(labels: MetricLabels): string {
  const sorted = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b))
  return JSON.stringify(sorted)
}

export class Counter {
  public name: string
  public help?: string
  private values = new Map<string, { value: number; labels: MetricLabels }>()

  constructor(name: string, help?: string) {
    this.name = name
    this.help = help
  }

  public inc(labels: MetricLabels = {}, value = 1): void {
    if (value < 0) {
      throw new Error('Counter can only be incremented with non-negative values')
    }
    const cleanLabels = validateLabels(labels)
    const key = serializeLabels(cleanLabels)
    const existing = this.values.get(key) || { value: 0, labels: cleanLabels }
    existing.value += value
    this.values.set(key, existing)
  }

  public get(labels: MetricLabels = {}): number {
    const key = serializeLabels(validateLabels(labels))
    return this.values.get(key)?.value ?? 0
  }

  public reset(): void {
    this.values.clear()
  }
}

export class Gauge {
  public name: string
  public help?: string
  private values = new Map<string, { value: number; labels: MetricLabels }>()

  constructor(name: string, help?: string) {
    this.name = name
    this.help = help
  }

  public set(labels: MetricLabels = {}, value: number): void {
    const cleanLabels = validateLabels(labels)
    const key = serializeLabels(cleanLabels)
    this.values.set(key, { value, labels: cleanLabels })
  }

  public inc(labels: MetricLabels = {}, value = 1): void {
    const cleanLabels = validateLabels(labels)
    const key = serializeLabels(cleanLabels)
    const existing = this.values.get(key) || { value: 0, labels: cleanLabels }
    existing.value += value
    this.values.set(key, existing)
  }

  public dec(labels: MetricLabels = {}, value = 1): void {
    this.inc(labels, -value)
  }

  public get(labels: MetricLabels = {}): number {
    const key = serializeLabels(validateLabels(labels))
    return this.values.get(key)?.value ?? 0
  }

  public reset(): void {
    this.values.clear()
  }
}

export class Histogram {
  public name: string
  public help?: string
  private series = new Map<string, { observations: number[]; labels: MetricLabels }>()

  constructor(name: string, help?: string) {
    this.name = name
    this.help = help
  }

  public observe(labels: MetricLabels = {}, value: number): void {
    const cleanLabels = validateLabels(labels)
    const key = serializeLabels(cleanLabels)
    const entry = this.series.get(key) || { observations: [], labels: cleanLabels }
    entry.observations.push(value)
    this.series.set(key, entry)
  }

  public getSnapshot(labels: MetricLabels = {}): HistogramSnapshot {
    const key = serializeLabels(validateLabels(labels))
    const entry = this.series.get(key)
    const obs = entry?.observations || []

    if (obs.length === 0) {
      return { count: 0, sum: 0, min: 0, max: 0, avg: 0, p50: 0, p90: 0, p99: 0 }
    }

    const sorted = [...obs].sort((a, b) => a - b)
    const sum = sorted.reduce((acc, v) => acc + v, 0)
    const count = sorted.length

    return {
      count,
      sum,
      min: sorted[0],
      max: sorted[count - 1],
      avg: Math.round((sum / count) * 100) / 100,
      p50: sorted[Math.floor(count * 0.5)],
      p90: sorted[Math.floor(count * 0.9)],
      p99: sorted[Math.floor(count * 0.99)],
    }
  }

  public reset(): void {
    this.series.clear()
  }
}

/**
 * Standard AI Pricing Table (USD per 1,000 tokens)
 */
export const KNOWN_MODEL_PRICING: Record<string, { promptPer1k: number; completionPer1k: number }> = {
  'gpt-4o': { promptPer1k: 0.0025, completionPer1k: 0.01 },
  'gpt-4o-mini': { promptPer1k: 0.00015, completionPer1k: 0.0006 },
  'claude-3-5-sonnet': { promptPer1k: 0.003, completionPer1k: 0.015 },
  'gemini-1.5-flash': { promptPer1k: 0.000075, completionPer1k: 0.0003 },
  'gemini-1.5-pro': { promptPer1k: 0.00125, completionPer1k: 0.005 },
}

export function calculateAiCost(
  model: string,
  promptTokens?: number,
  completionTokens?: number
): number | undefined {
  if (promptTokens === undefined && completionTokens === undefined) {
    return undefined
  }

  const normalized = model.toLowerCase().trim()
  const pricing = KNOWN_MODEL_PRICING[normalized]
  if (!pricing) {
    // Transparent: do not invent figures if pricing is not configured!
    return undefined
  }

  const pTokens = promptTokens ?? 0
  const cTokens = completionTokens ?? 0

  const cost = (pTokens / 1000) * pricing.promptPer1k + (cTokens / 1000) * pricing.completionPer1k
  return Math.round(cost * 1_000_000) / 1_000_000 // 6 decimal precision
}

export class MetricsRegistry {
  private counters = new Map<string, Counter>()
  private gauges = new Map<string, Gauge>()
  private histograms = new Map<string, Histogram>()

  constructor() {
    this.registerStandardMetrics()
  }

  public counter(name: string, help?: string): Counter {
    let c = this.counters.get(name)
    if (!c) {
      c = new Counter(name, help)
      this.counters.set(name, c)
    }
    return c
  }

  public gauge(name: string, help?: string): Gauge {
    let g = this.gauges.get(name)
    if (!g) {
      g = new Gauge(name, help)
      this.gauges.set(name, g)
    }
    return g
  }

  public histogram(name: string, help?: string): Histogram {
    let h = this.histograms.get(name)
    if (!h) {
      h = new Histogram(name, help)
      this.histograms.set(name, h)
    }
    return h
  }

  public recordAiUsage(usage: AiUsageMetadata): void {
    const labels = {
      provider: usage.provider,
      model: usage.model,
    }

    this.counter('ai_requests_total').inc(labels, 1)

    if (usage.totalTokens) {
      this.counter('ai_tokens_total').inc(labels, usage.totalTokens)
    }

    if (usage.latencyMs) {
      this.histogram('ai_request_duration_ms').observe(labels, usage.latencyMs)
    }
  }

  public resetAll(): void {
    for (const c of this.counters.values()) c.reset()
    for (const g of this.gauges.values()) g.reset()
    for (const h of this.histograms.values()) h.reset()
  }

  private registerStandardMetrics(): void {
    this.counter('http_requests_total', 'Total HTTP requests processed')
    this.histogram('http_request_duration_ms', 'HTTP request duration in ms')
    this.counter('ai_requests_total', 'Total AI model inferences executed')
    this.counter('ai_tokens_total', 'Total AI tokens consumed')
    this.histogram('ai_request_duration_ms', 'AI model inference latency in ms')
    this.counter('agent_runs_total', 'Total autonomous agent runs executed')
    this.histogram('agent_run_duration_ms', 'Agent run duration in ms')
    this.counter('job_executions_total', 'Total background jobs executed')
  }
}

export const sharedMetrics = new MetricsRegistry()
