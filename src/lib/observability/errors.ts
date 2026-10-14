/**
 * Sanitized Error Reporting & Exception Capture Adapter
 * 
 * Reference: Sentry JS SDK (https://github.com/getsentry/sentry-javascript)
 * 
 * Capabilities:
 * - Provider-independent error capture (captureException, captureMessage)
 * - Deep redaction of contextual metadata, environment tags, and breadcrumbs
 * - Breadcrumbs buffer leading up to errors
 * - Mock adapter for testing and zero-crash fallback when external services are unconfigured
 */

import crypto from 'crypto'
import type {
  IErrorReportingAdapter,
  CapturedErrorRecord,
  Breadcrumb,
} from './types'
import { redactSensitiveData } from '../logging/logger'

export class MockErrorReportingAdapter implements IErrorReportingAdapter {
  private capturedErrors: CapturedErrorRecord[] = []
  private capturedMessages: { message: string; level: string; context?: unknown }[] = []

  public async captureException(
    err: unknown,
    context: {
      tags?: Record<string, string>
      extra?: Record<string, unknown>
      breadcrumbs?: Breadcrumb[]
      user?: { id?: string }
    } = {}
  ): Promise<string> {
    const id = `err_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`

    const errorDetails = err instanceof Error
      ? {
          name: err.name,
          message: String(redactSensitiveData(err.message)),
          stack: redactSensitiveData(err.stack) as string,
        }
      : {
          name: 'UnknownError',
          message: String(redactSensitiveData(String(err))),
        }

    const record: CapturedErrorRecord = {
      id,
      error: errorDetails,
      timestamp: Date.now(),
      environment: process.env.NODE_ENV || 'test',
      release: process.env.NEXT_PUBLIC_APP_VERSION,
      tags: redactSensitiveData(context.tags) as Record<string, string>,
      context: redactSensitiveData(context.extra) as Record<string, unknown>,
      breadcrumbs: context.breadcrumbs ? (redactSensitiveData(context.breadcrumbs) as Breadcrumb[]) : undefined,
    }

    this.capturedErrors.push(record)
    return id
  }

  public async captureMessage(
    message: string,
    level: 'info' | 'warn' | 'error' = 'info',
    context?: { tags?: Record<string, string>; extra?: Record<string, unknown> }
  ): Promise<string> {
    const id = `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    this.capturedMessages.push({
      message: String(redactSensitiveData(message)),
      level,
      context: redactSensitiveData(context),
    })
    return id
  }

  public getCapturedErrors(): CapturedErrorRecord[] {
    return [...this.capturedErrors]
  }

  public getCapturedMessages(): { message: string; level: string; context?: unknown }[] {
    return [...this.capturedMessages]
  }

  public clear(): void {
    this.capturedErrors = []
    this.capturedMessages = []
  }
}

export class ErrorReporter {
  private adapter: IErrorReportingAdapter
  private breadcrumbs: Breadcrumb[] = []
  private maxBreadcrumbs: number

  constructor(adapter?: IErrorReportingAdapter, maxBreadcrumbs = 25) {
    this.adapter = adapter ?? new MockErrorReportingAdapter()
    this.maxBreadcrumbs = Math.max(5, maxBreadcrumbs)
  }

  public setAdapter(adapter: IErrorReportingAdapter): void {
    this.adapter = adapter
  }

  public getAdapter(): IErrorReportingAdapter {
    return this.adapter
  }

  public addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
    const entry: Breadcrumb = {
      ...breadcrumb,
      message: String(redactSensitiveData(breadcrumb.message)),
      timestamp: Date.now(),
      data: breadcrumb.data ? (redactSensitiveData(breadcrumb.data) as Record<string, unknown>) : undefined,
    }

    this.breadcrumbs.push(entry)
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift()
    }
  }

  public getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs]
  }

  public clearBreadcrumbs(): void {
    this.breadcrumbs = []
  }

  public async captureException(
    err: unknown,
    context?: {
      tags?: Record<string, string>
      extra?: Record<string, unknown>
      user?: { id?: string }
    }
  ): Promise<string> {
    try {
      return await Promise.resolve(
        this.adapter.captureException(err, {
          ...context,
          breadcrumbs: this.getBreadcrumbs(),
        })
      )
    } catch {
      // Safe fallback: error reporting failures never crash core application flows
      return 'error_capture_failed'
    }
  }

  public async captureMessage(
    message: string,
    level: 'info' | 'warn' | 'error' = 'info',
    context?: { tags?: Record<string, string>; extra?: Record<string, unknown> }
  ): Promise<string> {
    try {
      return await Promise.resolve(this.adapter.captureMessage(message, level, context))
    } catch {
      return 'message_capture_failed'
    }
  }
}

export const sharedErrorReporter = new ErrorReporter()
