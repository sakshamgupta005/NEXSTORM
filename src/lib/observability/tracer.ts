/**
 * Request, AI, Agent & Job Tracing Engine
 * 
 * Reference: OpenTelemetry (https://github.com/open-telemetry/opentelemetry-js)
 * 
 * Capabilities:
 * - W3C-compatible traceparent header propagation (traceId, spanId)
 * - Span lifecycle tracking with automatic latency measurement
 * - Context inheritance across HTTP, AI, Agent tools, and Background jobs
 * - Zero external collectors required: operates in-memory for testing and local dev
 * - Privacy-by-default: raw prompts, credentials, and user bodies are excluded from span tags
 */

import crypto from 'crypto'
import type {
  SpanKind,
  SpanStatus,
  TraceContext,
  SpanRecord,
} from './types'
import { redactSensitiveData } from '../logging/logger'

export function generateTraceId(): string {
  return crypto.randomBytes(16).toString('hex')
}

export function generateSpanId(): string {
  return crypto.randomBytes(8).toString('hex')
}

export class Span {
  public traceId: string
  public spanId: string
  public parentSpanId?: string
  public name: string
  public kind: SpanKind
  public startTime: number
  public endTime?: number
  public status: SpanStatus = 'unset'
  public tags: Record<string, unknown> = {}
  public error?: { name: string; message: string; stack?: string }
  private onEnd: (span: SpanRecord) => void

  constructor(
    name: string,
    kind: SpanKind,
    context: TraceContext,
    onEnd: (record: SpanRecord) => void,
    initialTags: Record<string, unknown> = {}
  ) {
    this.name = name
    this.kind = kind
    this.traceId = context.traceId
    this.spanId = context.spanId
    this.parentSpanId = context.parentSpanId
    this.startTime = Date.now()
    this.tags = { ...initialTags }
    this.onEnd = onEnd
  }

  public setTag(key: string, value: unknown): this {
    // Redact sensitive values before storing in span tags
    this.tags[key] = redactSensitiveData(value)
    return this
  }

  public setStatus(status: SpanStatus): this {
    this.status = status
    return this
  }

  public recordError(err: unknown): this {
    this.status = 'error'
    if (err instanceof Error) {
      this.error = {
        name: err.name,
        message: String(redactSensitiveData(err.message)),
        stack: redactSensitiveData(err.stack) as string,
      }
    } else {
      this.error = {
        name: 'Error',
        message: String(redactSensitiveData(String(err))),
      }
    }
    return this
  }

  public getContext(): TraceContext {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
    }
  }

  public end(): SpanRecord {
    this.endTime = Date.now()
    const durationMs = Math.max(0, this.endTime - this.startTime)

    const record: SpanRecord = {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      name: this.name,
      kind: this.kind,
      status: this.status === 'unset' ? 'ok' : this.status,
      startTime: this.startTime,
      endTime: this.endTime,
      durationMs,
      tags: this.tags,
      error: this.error,
    }

    this.onEnd(record)
    return record
  }
}

export class Tracer {
  private completedSpans: SpanRecord[] = []
  private maxStoredSpans: number
  private currentActiveContext: TraceContext | null = null

  constructor(options: { maxStoredSpans?: number } = {}) {
    this.maxStoredSpans = Math.max(10, options.maxStoredSpans ?? 500)
  }

  public startSpan(
    name: string,
    kind: SpanKind,
    options: {
      parent?: TraceContext | Span
      tags?: Record<string, unknown>
    } = {}
  ): Span {
    const parentCtx = options.parent instanceof Span ? options.parent.getContext() : options.parent

    const traceId = parentCtx?.traceId || this.currentActiveContext?.traceId || generateTraceId()
    const parentSpanId = parentCtx?.spanId || this.currentActiveContext?.spanId
    const spanId = generateSpanId()

    const context: TraceContext = {
      traceId,
      spanId,
      parentSpanId,
    }

    return new Span(
      name,
      kind,
      context,
      (record) => {
        this.completedSpans.push(record)
        if (this.completedSpans.length > this.maxStoredSpans) {
          this.completedSpans.shift()
        }
      },
      options.tags
    )
  }

  public async withSpan<T>(
    name: string,
    kind: SpanKind,
    fn: (span: Span) => Promise<T> | T,
    options: {
      parent?: TraceContext | Span
      tags?: Record<string, unknown>
    } = {}
  ): Promise<T> {
    const span = this.startSpan(name, kind, options)
    const prevContext = this.currentActiveContext
    this.currentActiveContext = span.getContext()

    try {
      const result = await Promise.resolve(fn(span))
      if (span.status === 'unset') {
        span.setStatus('ok')
      }
      return result
    } catch (err: unknown) {
      span.recordError(err)
      throw err
    } finally {
      this.currentActiveContext = prevContext
      span.end()
    }
  }

  public getCompletedSpans(): SpanRecord[] {
    return [...this.completedSpans]
  }

  public clearSpans(): void {
    this.completedSpans = []
  }

  /**
   * Generates W3C traceparent header value (e.g. 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01)
   */
  public toTraceparent(context: TraceContext): string {
    return `00-${context.traceId}-${context.spanId}-01`
  }

  /**
   * Parses W3C traceparent header value
   */
  public parseTraceparent(header?: string | null): TraceContext | null {
    if (!header || typeof header !== 'string') return null
    const parts = header.trim().split('-')
    if (parts.length < 4 || parts[0] !== '00') return null

    const traceId = parts[1]
    const spanId = parts[2]

    if (traceId.length !== 32 || spanId.length !== 16) return null

    return { traceId, spanId }
  }
}

export const sharedTracer = new Tracer()
