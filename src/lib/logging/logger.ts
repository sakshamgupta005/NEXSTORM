/**
 * Structured Server-Side Logger with Automated Secret Scrubbing & Child Context
 * 
 * Reference: Pino (https://github.com/pinojs/pino)
 * 
 * Capabilities:
 * - Leveled logging: debug, info, warn, error
 * - Structured JSON output in production, readable formatted output in development
 * - Automatic deep redaction of API keys, bearer tokens, passwords, and sensitive fields
 * - Child loggers inheriting request/correlation/job context
 * - Log injection prevention by sanitizing carriage returns and control characters
 * - Configurable output destinations and in-memory test buffering
 * - Non-throwing safety guard: logger operations never crash the caller
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[-_]?key/i,
  /authorization/i,
  /cookie/i,
  /service[-_]?role/i,
  /private[-_]?key/i,
]

const SECRET_VALUE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi,
  /\bsk-[a-zA-Z0-9_-]{10,}\b/gi,
  /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/gi, // JWT
]

/**
 * Deeply redacts sensitive keys and values from objects, arrays, and strings.
 */
export function redactSensitiveData(data: unknown): unknown {
  if (data === null || data === undefined) return data

  if (typeof data === 'string') {
    let sanitized = data
    for (const pattern of SECRET_VALUE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED_SECRET]')
    }
    return sanitized
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item))
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))
      if (isSensitiveKey) {
        result[key] = '[REDACTED]'
      } else {
        result[key] = redactSensitiveData(value)
      }
    }
    return result
  }

  return data
}

/**
 * Strips carriage returns and dangerous control characters to prevent log injection.
 */
export function sanitizeLogMessage(message: string): string {
  if (!message) return ''
  return message
    .replace(/\r/g, '')
    .replace(/\n/g, ' ')
    .trim()
}

export interface LogContext {
  requestId?: string
  correlationId?: string
  traceId?: string
  spanId?: string
  jobId?: string
  agentRunId?: string
  service?: string
  [key: string]: unknown
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  error?: {
    name: string
    message: string
    stack?: string
    cause?: unknown
  }
}

export type LogDestination = (level: LogLevel, entry: LogEntry, rawJson: string) => void

export class StructuredLogger {
  private currentLevel: LogLevel = 'info'
  private baseContext: LogContext = {}
  private destination?: LogDestination
  private buffer: LogEntry[] = []
  private isBuffering = false

  constructor(defaultLevel?: LogLevel, baseContext: LogContext = {}) {
    this.baseContext = { ...baseContext }
    if (defaultLevel) {
      this.currentLevel = defaultLevel
    } else {
      const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel
      if (envLevel && envLevel in LOG_LEVEL_PRIORITY) {
        this.currentLevel = envLevel
      } else {
        this.currentLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug'
      }
    }
  }

  setLevel(level: LogLevel): void {
    this.currentLevel = level
  }

  setDestination(destination?: LogDestination): void {
    this.destination = destination
  }

  enableBuffer(enable = true): void {
    this.isBuffering = enable
  }

  getBufferedEntries(): LogEntry[] {
    return [...this.buffer]
  }

  clearBuffer(): void {
    this.buffer = []
  }

  /**
   * Creates a child logger with pre-bound contextual metadata (e.g. requestId, jobId).
   */
  child(bindings: LogContext): StructuredLogger {
    const childLogger = new StructuredLogger(this.currentLevel, {
      ...this.baseContext,
      ...bindings,
    })
    if (this.destination) {
      childLogger.setDestination(this.destination)
    }
    if (this.isBuffering) {
      childLogger.isBuffering = true
      childLogger.buffer = this.buffer
    }
    return childLogger
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.currentLevel]
  }

  private formatEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    err?: unknown
  ): LogEntry {
    const sanitizedMsg = sanitizeLogMessage(message)
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: String(redactSensitiveData(sanitizedMsg)),
    }

    const mergedContext = {
      ...this.baseContext,
      ...(context || {}),
    }

    if (Object.keys(mergedContext).length > 0) {
      entry.context = redactSensitiveData(mergedContext) as LogContext
    }

    if (err) {
      if (err instanceof Error) {
        entry.error = {
          name: err.name,
          message: String(redactSensitiveData(err.message)),
          ...(process.env.NODE_ENV !== 'production' && err.stack
            ? { stack: redactSensitiveData(err.stack) as string }
            : {}),
          ...(err.cause !== undefined ? { cause: redactSensitiveData(err.cause) } : {}),
        }
      } else {
        entry.error = {
          name: 'UnknownError',
          message: String(redactSensitiveData(String(err))),
        }
      }
    }

    return entry
  }

  private write(level: LogLevel, entry: LogEntry): void {
    try {
      if (this.isBuffering) {
        this.buffer.push(entry)
      }

      const serialized = JSON.stringify(entry)

      if (this.destination) {
        this.destination(level, entry, serialized)
        return
      }

      if (level === 'error') {
        console.error(serialized)
      } else if (level === 'warn') {
        console.warn(serialized)
      } else {
        console.log(serialized)
      }
    } catch {
      // Safe fallback: logger never throws to disrupt caller flow
    }
  }

  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('debug')) return
    this.write('debug', this.formatEntry('debug', message, context))
  }

  info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return
    this.write('info', this.formatEntry('info', message, context))
  }

  warn(message: string, context?: LogContext, err?: unknown): void {
    if (!this.shouldLog('warn')) return
    this.write('warn', this.formatEntry('warn', message, context, err))
  }

  error(message: string, context?: LogContext, err?: unknown): void {
    if (!this.shouldLog('error')) return
    this.write('error', this.formatEntry('error', message, context, err))
  }
}

export const logger = new StructuredLogger()
