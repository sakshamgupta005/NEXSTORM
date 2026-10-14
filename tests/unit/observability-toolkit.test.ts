import { describe, it, expect, beforeEach } from 'vitest'
import {
  StructuredLogger,
  sanitizeLogMessage,
  Tracer,
  MetricsRegistry,
  calculateAiCost,
  ErrorReporter,
  MockErrorReportingAdapter,
} from '@/lib/observability'

describe('Part 4.12 — Analytics, Logging & Observability Toolkit', () => {
  describe('1. Structured Logging & Child Context', () => {
    let testLogger: StructuredLogger

    beforeEach(() => {
      testLogger = new StructuredLogger('debug')
      testLogger.enableBuffer(true)
    })

    it('creates child logger inheriting parent context and merging bindings', () => {
      const parentLogger = testLogger.child({ service: 'checkout-service', environment: 'production' })
      const requestLogger = parentLogger.child({ requestId: 'req_abc123' })

      requestLogger.info('Payment initiated', { amount: 5000 })

      const logs = testLogger.getBufferedEntries()
      expect(logs).toHaveLength(1)
      const entry = logs[0]

      expect(entry.level).toBe('info')
      expect(entry.message).toBe('Payment initiated')
      expect(entry.context?.service).toBe('checkout-service')
      expect(entry.context?.environment).toBe('production')
      expect(entry.context?.requestId).toBe('req_abc123')
      expect(entry.context?.amount).toBe(5000)
    })

    it('sanitizes carriage returns and line feeds to prevent log injection', () => {
      const malicious = 'Normal log\r\n[2026-10-12T00:00:00.000Z] [ERROR] Injected fake log entry'
      const sanitized = sanitizeLogMessage(malicious)

      expect(sanitized).not.toContain('\r')
      expect(sanitized).not.toContain('\n')
      expect(sanitized).toBe('Normal log [2026-10-12T00:00:00.000Z] [ERROR] Injected fake log entry')
    })

    it('redacts sensitive headers, tokens, and authorization fields from log context', () => {
      testLogger.info('User authenticated', {
        headers: {
          authorization: 'Bearer secret_token_xyz',
          cookie: 'session=abc123',
        },
        apiKey: 'sk-1234567890abcdef',
        normalField: 'ok',
      })

      const logs = testLogger.getBufferedEntries()
      const entry = logs[0]
      const ctx = entry.context as Record<string, unknown>
      const headers = ctx.headers as Record<string, unknown>

      expect(ctx.apiKey).toBe('[REDACTED]')
      expect(headers.authorization).toBe('[REDACTED]')
      expect(headers.cookie).toBe('[REDACTED]')
      expect(ctx.normalField).toBe('ok')
    })
  })

  describe('2. Request & Agent Tracing (Spans & Correlation IDs)', () => {
    let tracer: Tracer

    beforeEach(() => {
      tracer = new Tracer()
    })

    it('creates nested spans propagating traceId and parentSpanId across agent execution', async () => {
      await tracer.withSpan('agent_orchestration', 'agent', async (agentSpan) => {
        agentSpan.setTag('agentId', 'agent_coder')

        await tracer.withSpan('tool_web_search', 'tool', async (toolSpan) => {
          toolSpan.setTag('query', 'Next.js 16 App Router')
          return 'search_results'
        }, { parent: agentSpan })

        return 'agent_done'
      })

      const spans = tracer.getCompletedSpans()
      expect(spans).toHaveLength(2)

      const toolSpan = spans.find((s) => s.name === 'tool_web_search')!
      const agentSpan = spans.find((s) => s.name === 'agent_orchestration')!

      expect(toolSpan).toBeDefined()
      expect(agentSpan).toBeDefined()

      // Trace ID must correlate across both spans!
      expect(toolSpan.traceId).toBe(agentSpan.traceId)
      expect(toolSpan.parentSpanId).toBe(agentSpan.spanId)
      expect(toolSpan.status).toBe('ok')
      expect(toolSpan.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('records error details and status when an in-flight operation throws', async () => {
      let thrown = false
      try {
        await tracer.withSpan('ai_completion', 'ai', async () => {
          throw new Error('API rate limit exceeded 429')
        })
      } catch {
        thrown = true
      }

      expect(thrown).toBe(true)
      const spans = tracer.getCompletedSpans()
      expect(spans).toHaveLength(1)

      const span = spans[0]
      expect(span.status).toBe('error')
      expect(span.error?.message).toContain('API rate limit exceeded 429')
    })

    it('formats and parses W3C traceparent headers correctly', () => {
      const traceCtx = {
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        spanId: '00f067aa0ba902b7',
      }

      const header = tracer.toTraceparent(traceCtx)
      expect(header).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01')

      const parsed = tracer.parseTraceparent(header)
      expect(parsed?.traceId).toBe(traceCtx.traceId)
      expect(parsed?.spanId).toBe(traceCtx.spanId)
    })
  })

  describe('3. Metrics Registry & Low-Cardinality Guardrails', () => {
    let metrics: MetricsRegistry

    beforeEach(() => {
      metrics = new MetricsRegistry()
    })

    it('rejects high-cardinality metric labels to prevent unbounded memory growth', () => {
      const counter = metrics.counter('test_requests')

      // Should throw when attempting to use user IDs or URLs as label keys
      expect(() => {
        counter.inc({ userId: 'usr_12345' })
      }).toThrow(/High-cardinality metric label rejected: 'userId'/)

      expect(() => {
        counter.inc({ url: '/api/users/999' })
      }).toThrow(/High-cardinality metric label rejected: 'url'/)
    })

    it('tracks Counter increments and Gauge values accurately', () => {
      const counter = metrics.counter('api_calls')
      counter.inc({ method: 'POST', status: '200' }, 2)
      counter.inc({ method: 'POST', status: '200' }, 3)

      expect(counter.get({ method: 'POST', status: '200' })).toBe(5)
      expect(counter.get({ method: 'GET', status: '200' })).toBe(0)

      const gauge = metrics.gauge('queue_size')
      gauge.set({ queue: 'default' }, 10)
      gauge.inc({ queue: 'default' }, 5)
      gauge.dec({ queue: 'default' }, 2)
      expect(gauge.get({ queue: 'default' })).toBe(13)
    })

    it('calculates Histogram distributions (count, sum, min, max, avg, percentiles)', () => {
      const hist = metrics.histogram('latency_ms')

      const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
      for (const val of values) {
        hist.observe({ route: '/api/chat' }, val)
      }

      const snapshot = hist.getSnapshot({ route: '/api/chat' })
      expect(snapshot.count).toBe(10)
      expect(snapshot.sum).toBe(550)
      expect(snapshot.min).toBe(10)
      expect(snapshot.max).toBe(100)
      expect(snapshot.avg).toBe(55)
      expect(snapshot.p50).toBe(60)
    })

    it('records AI usage and calculates cost strictly when pricing is configured', () => {
      // Configured model: gpt-4o ($0.0025 / 1k prompt, $0.01 / 1k completion)
      const cost = calculateAiCost('gpt-4o', 1000, 500)
      // 1 * 0.0025 + 0.5 * 0.01 = 0.0025 + 0.005 = 0.0075
      expect(cost).toBe(0.0075)

      // Unconfigured model returns undefined rather than inventing false numbers
      const unconfiguredCost = calculateAiCost('unknown-custom-model-v1', 1000, 500)
      expect(unconfiguredCost).toBeUndefined()
    })
  })

  describe('4. Sanitized Error Reporting & Breadcrumbs', () => {
    let reporter: ErrorReporter
    let mockAdapter: MockErrorReportingAdapter

    beforeEach(() => {
      mockAdapter = new MockErrorReportingAdapter()
      reporter = new ErrorReporter(mockAdapter, 10)
    })

    it('captures sanitized exceptions with breadcrumb trail leading to failure', async () => {
      reporter.addBreadcrumb({ category: 'auth', message: 'User initiated OAuth handshake' })
      reporter.addBreadcrumb({ category: 'network', message: 'Connecting to Supabase auth endpoint' })

      const error = new Error('OAuth token verification failed with secret sk-9999999999')
      const errorId = await reporter.captureException(error, {
        tags: { environment: 'production' },
        extra: { attemptCount: 3, token: 'secret-token' },
      })

      expect(errorId).toMatch(/^err_/)
      const captured = mockAdapter.getCapturedErrors()
      expect(captured).toHaveLength(1)

      const record = captured[0]
      expect(record.error.message).toContain('[REDACTED_SECRET]')
      expect(record.error.message).not.toContain('sk-9999999999')
      expect(record.context?.token).toBe('[REDACTED]')
      expect(record.context?.attemptCount).toBe(3)
      expect(record.breadcrumbs).toHaveLength(2)
      expect(record.breadcrumbs?.[0].message).toBe('User initiated OAuth handshake')
    })

    it('handles adapter failure safely without crashing application code', async () => {
      const failingAdapter = {
        captureException: () => {
          throw new Error('Sentry network failure 503')
        },
        captureMessage: () => {
          throw new Error('Sentry network failure 503')
        },
      }

      const safeReporter = new ErrorReporter(failingAdapter)
      const errorId = await safeReporter.captureException(new Error('Test'))

      expect(errorId).toBe('error_capture_failed')
    })
  })
})
