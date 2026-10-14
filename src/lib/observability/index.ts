/**
 * Reusable Analytics, Logging & Observability Toolkit
 * 
 * Provides:
 * - Structured logging with child loggers and automated secret scrubbing (`StructuredLogger`, `logger`, `redactSensitiveData`)
 * - Tracing and span propagation for HTTP, AI, Agents, and Background Jobs (`Tracer`, `Span`, `sharedTracer`)
 * - Application metrics (Counter, Gauge, Histogram) and low-cardinality label validation (`MetricsRegistry`, `sharedMetrics`)
 * - AI usage and cost tracking (`calculateAiCost`)
 * - Error and exception reporting with breadcrumbs (`ErrorReporter`, `sharedErrorReporter`, `MockErrorReportingAdapter`)
 */

export * from '../logging/logger'
export * from './types'
export * from './tracer'
export * from './metrics'
export * from './errors'
