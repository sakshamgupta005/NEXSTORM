/**
 * Analytics, Logging & Observability Toolkit — Types & Contracts
 * 
 * References Studied:
 * - Pino (https://github.com/pinojs/pino) — Fast JSON logging & child loggers
 * - OpenTelemetry JS (https://github.com/open-telemetry/opentelemetry-js) — Traces, Spans, correlation context
 * - Prometheus client (https://github.com/siimon/prom-client) — Counters, Gauges, Histograms, low-cardinality labels
 * - Sentry JS SDK (https://github.com/getsentry/sentry-javascript) — Exception capture, breadcrumbs, sanitized metadata
 */

export type SpanKind =
  | 'http'
  | 'ai'
  | 'agent'
  | 'tool'
  | 'job'
  | 'workflow'
  | 'db'
  | 'internal'

export type SpanStatus = 'ok' | 'error' | 'unset'

export interface TraceContext {
  traceId: string
  spanId: string
  parentSpanId?: string
}

export interface SpanRecord {
  traceId: string
  spanId: string
  parentSpanId?: string
  name: string
  kind: SpanKind
  status: SpanStatus
  startTime: number
  endTime?: number
  durationMs?: number
  tags: Record<string, unknown>
  error?: {
    name: string
    message: string
    stack?: string
  }
}

export interface AiUsageMetadata {
  provider: string
  model: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  estimatedCostUsd?: number
  latencyMs?: number
}

export type MetricType = 'counter' | 'gauge' | 'histogram'

export type MetricLabels = Record<string, string>

export interface HistogramSnapshot {
  count: number
  sum: number
  min: number
  max: number
  avg: number
  p50: number
  p90: number
  p99: number
}

export interface Breadcrumb {
  message: string
  category?: string
  level?: 'info' | 'warn' | 'error'
  timestamp: number
  data?: Record<string, unknown>
}

export interface CapturedErrorRecord {
  id: string
  error: {
    name: string
    message: string
    stack?: string
  }
  timestamp: number
  environment: string
  release?: string
  tags?: Record<string, string>
  context?: Record<string, unknown>
  breadcrumbs?: Breadcrumb[]
}

export interface IErrorReportingAdapter {
  captureException(
    err: unknown,
    context?: {
      tags?: Record<string, string>
      extra?: Record<string, unknown>
      breadcrumbs?: Breadcrumb[]
      user?: { id?: string }
    }
  ): Promise<string> | string
  captureMessage(
    message: string,
    level?: 'info' | 'warn' | 'error',
    context?: { tags?: Record<string, string>; extra?: Record<string, unknown> }
  ): Promise<string> | string
}
