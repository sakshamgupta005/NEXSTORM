/**
 * Local In-Memory Background Job Queue Engine
 * 
 * Reference: BullMQ (https://github.com/taskforcesh/bullmq)
 * 
 * Capabilities:
 * - Priority-ordered processing
 * - Configurable worker concurrency limits
 * - Explicit retry policies with fixed/exponential backoff
 * - Non-idempotent operation protection (suppresses unsafe retries on payments/emails)
 * - Submission idempotency deduplication
 * - Execution timeout enforcement with AbortController
 * - Progress tracking and typed event emission
 * - Graceful shutdown and worker draining
 * - Zero external infrastructure: operates offline and in testing environments
 */

import type {
  IJobQueue,
  JobRecord,
  JobStatus,
  JobHandler,
  EnqueueOptions,
  JobQueueStats,
  JobEventType,
  JobEventListener,
  JobProgress,
  RetryPolicy,
} from './types'

export interface LocalJobQueueOptions {
  /** Maximum number of concurrent jobs being processed simultaneously (default: 3) */
  concurrency?: number
  /** Polling interval in ms for delayed jobs (default: 100) */
  pollIntervalMs?: number
  /** Idempotency key TTL in ms (default: 24h = 86_400_000ms) */
  idempotencyTtlMs?: number
}

interface HandlerRegistration {
  handler: JobHandler<unknown, unknown>
  defaultOptions?: Partial<EnqueueOptions>
}

export class LocalJobQueue implements IJobQueue {
  private jobs = new Map<string, JobRecord<unknown, unknown>>()
  private handlers = new Map<string, HandlerRegistration>()
  private idempotencyMap = new Map<string, { jobId: string; expiresAt: number }>()
  private activeControllers = new Map<string, AbortController>()
  private listeners = new Set<JobEventListener>()

  private concurrency: number
  private pollIntervalMs: number
  private idempotencyTtlMs: number

  private isRunning = false
  private pollTimer: NodeJS.Timeout | null = null
  private runningCount = 0
  private jobCounter = 1

  constructor(options: LocalJobQueueOptions = {}) {
    this.concurrency = Math.max(1, options.concurrency ?? 3)
    this.pollIntervalMs = Math.max(25, options.pollIntervalMs ?? 100)
    this.idempotencyTtlMs = options.idempotencyTtlMs ?? 24 * 60 * 60 * 1000
    this.start()
  }

  public registerHandler<TData = unknown, TResult = unknown>(
    name: string,
    handler: JobHandler<TData, TResult>,
    defaultOptions?: Partial<EnqueueOptions>
  ): void {
    this.handlers.set(name, {
      handler: handler as unknown as JobHandler<unknown, unknown>,
      defaultOptions,
    })
  }

  public async enqueue<TData = unknown, TResult = unknown>(
    name: string,
    data: TData,
    options: EnqueueOptions = {}
  ): Promise<JobRecord<TData, TResult>> {
    const now = Date.now()

    // 1. Idempotency Check
    if (options.idempotencyKey) {
      const existing = this.idempotencyMap.get(options.idempotencyKey)
      if (existing && existing.expiresAt > now) {
        const existingJob = this.jobs.get(existing.jobId)
        if (existingJob) {
          return existingJob as JobRecord<TData, TResult>
        }
      }
    }

    // 2. Resolve default options from registered handler
    const registration = this.handlers.get(name)
    const defaults = registration?.defaultOptions ?? {}

    const priority = options.priority ?? defaults.priority ?? 0
    const delayMs = options.delayMs ?? defaults.delayMs ?? 0
    const runAt = options.runAt ?? (delayMs > 0 ? now + delayMs : defaults.runAt ?? now)
    const timeoutMs = options.timeoutMs ?? defaults.timeoutMs
    const isIdempotent = options.isIdempotent ?? defaults.isIdempotent ?? false

    const retryPolicy: RetryPolicy = options.retryPolicy ?? defaults.retryPolicy ?? {
      maxRetries: isIdempotent ? 2 : 0,
      backoffMs: 500,
      strategy: 'exponential',
      backoffMultiplier: 2,
    }

    const id = `job_${Date.now()}_${this.jobCounter++}_${Math.random().toString(36).substring(2, 7)}`

    const job: JobRecord<TData, TResult> = {
      id,
      name,
      data,
      status: 'queued',
      priority,
      runAt,
      timeoutMs,
      retryPolicy,
      isIdempotent,
      idempotencyKey: options.idempotencyKey,
      attempts: 0,
      maxRetries: retryPolicy.maxRetries,
      metadata: options.metadata,
      createdAt: now,
    }

    this.jobs.set(id, job)

    if (options.idempotencyKey) {
      this.idempotencyMap.set(options.idempotencyKey, {
        jobId: id,
        expiresAt: now + this.idempotencyTtlMs,
      })
    }

    this.emitEvent('job:queued', job)
    this.scheduleDispatch()

    return job
  }

  public async getJob<TData = unknown, TResult = unknown>(
    id: string
  ): Promise<JobRecord<TData, TResult> | null> {
    const job = this.jobs.get(id)
    return (job as JobRecord<TData, TResult>) || null
  }

  public async cancelJob(id: string): Promise<boolean> {
    const job = this.jobs.get(id)
    if (!job) return false

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return false
    }

    if (job.status === 'running') {
      const controller = this.activeControllers.get(id)
      if (controller) {
        controller.abort()
      }
    }

    job.status = 'cancelled'
    job.finishedAt = Date.now()
    this.emitEvent('job:cancelled', job)
    return true
  }

  public async getStats(): Promise<JobQueueStats> {
    const stats: JobQueueStats = {
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      total: this.jobs.size,
    }

    for (const job of this.jobs.values()) {
      stats[job.status]++
    }

    return stats
  }

  public start(): void {
    if (this.isRunning) return
    this.isRunning = true
    this.scheduleNextPoll()
  }

  public async stop(drainTimeoutMs = 5000): Promise<void> {
    this.isRunning = false
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }

    if (this.runningCount === 0) return

    // Await running jobs to drain or force abort after drainTimeoutMs
    const startTime = Date.now()
    while (this.runningCount > 0 && Date.now() - startTime < drainTimeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    if (this.runningCount > 0) {
      for (const [id, controller] of this.activeControllers.entries()) {
        controller.abort()
        const job = this.jobs.get(id)
        if (job && job.status === 'running') {
          job.status = 'cancelled'
          job.finishedAt = Date.now()
          this.emitEvent('job:cancelled', job)
        }
      }
      this.activeControllers.clear()
      this.runningCount = 0
    }
  }

  public on(listener: JobEventListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  // ============================================================================
  // Internal Dispatch & Execution Engine
  // ============================================================================

  private scheduleNextPoll(): void {
    if (!this.isRunning) return
    this.pollTimer = setTimeout(() => {
      this.dispatchNext()
      this.scheduleNextPoll()
    }, this.pollIntervalMs)
  }

  private scheduleDispatch(): void {
    if (!this.isRunning) return
    setImmediate(() => this.dispatchNext())
  }

  private dispatchNext(): void {
    if (!this.isRunning || this.runningCount >= this.concurrency) return

    const now = Date.now()

    // Find candidate jobs: status === 'queued' and runAt <= now
    const eligibleJobs = Array.from(this.jobs.values())
      .filter((j) => j.status === 'queued' && j.runAt <= now)
      .sort((a, b) => {
        // Priority descending, then creation time ascending (FIFO)
        if (b.priority !== a.priority) return b.priority - a.priority
        return a.createdAt - b.createdAt
      })

    while (this.runningCount < this.concurrency && eligibleJobs.length > 0) {
      const nextJob = eligibleJobs.shift()
      if (!nextJob) break

      this.runningCount++
      this.executeJob(nextJob).finally(() => {
        this.runningCount--
        this.scheduleDispatch()
      })
    }
  }

  private async executeJob(job: JobRecord<unknown, unknown>): Promise<void> {
    const registration = this.handlers.get(job.name)
    if (!registration) {
      job.status = 'failed'
      job.finishedAt = Date.now()
      job.error = {
        message: `No handler registered for job name: '${job.name}'`,
        attempt: job.attempts,
        failedAt: Date.now(),
        isFinal: true,
      }
      this.emitEvent('job:failed', job)
      return
    }

    job.status = 'running'
    job.startedAt = Date.now()
    job.attempts++
    this.emitEvent('job:started', job)

    const abortController = new AbortController()
    this.activeControllers.set(job.id, abortController)

    let timeoutId: NodeJS.Timeout | null = null

    try {
      const executionPromise = Promise.resolve(
        registration.handler(job, {
          signal: abortController.signal,
          updateProgress: (percent: number, message?: string) => {
            this.handleProgressUpdate(job.id, percent, message)
          },
          log: () => {
            // Non-logging secret safe hook
          },
        })
      )

      let resultPromise: Promise<unknown> = executionPromise

      if (job.timeoutMs && job.timeoutMs > 0) {
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            abortController.abort()
            reject(new Error(`Job '${job.name}' timed out after ${job.timeoutMs}ms`))
          }, job.timeoutMs)
        })
        resultPromise = Promise.race([executionPromise, timeoutPromise])
      }

      const output = await resultPromise

      if ((job.status as JobStatus) === 'cancelled') return

      job.status = 'completed'
      job.result = output
      job.finishedAt = Date.now()
      this.emitEvent('job:completed', job)
    } catch (err: unknown) {
      if ((job.status as JobStatus) === 'cancelled') return

      const errorMessage = err instanceof Error ? err.message : String(err)
      const errorStack = err instanceof Error ? err.stack : undefined

      // Check whether retry is permitted
      const canRetry = this.evaluateRetryEligibility(job)

      if (canRetry) {
        const delay = this.calculateBackoffDelay(job)
        job.status = 'queued'
        job.runAt = Date.now() + delay
        job.error = {
          message: errorMessage,
          stack: errorStack,
          attempt: job.attempts,
          failedAt: Date.now(),
          isFinal: false,
        }
        this.emitEvent('job:failed', job)
      } else {
        job.status = 'failed'
        job.finishedAt = Date.now()
        job.error = {
          message: errorMessage,
          stack: errorStack,
          attempt: job.attempts,
          failedAt: Date.now(),
          isFinal: true,
        }
        this.emitEvent('job:failed', job)
      }
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      this.activeControllers.delete(job.id)
    }
  }

  private evaluateRetryEligibility(job: JobRecord<unknown, unknown>): boolean {
    if (job.attempts > job.retryPolicy.maxRetries) {
      return false
    }

    // Crucial safety check: if non-idempotent and not explicitly declared safe, refuse automatic retry!
    if (!job.isIdempotent && !job.retryPolicy.nonIdempotentSafe) {
      return false
    }

    return true
  }

  private calculateBackoffDelay(job: JobRecord<unknown, unknown>): number {
    const baseMs = job.retryPolicy.backoffMs ?? 1000
    if (job.retryPolicy.strategy === 'fixed') {
      return baseMs
    }

    const multiplier = job.retryPolicy.backoffMultiplier ?? 2
    // Exponential backoff: base * (multiplier ^ (attempts - 1))
    return baseMs * Math.pow(multiplier, Math.max(0, job.attempts - 1))
  }

  private handleProgressUpdate(jobId: string, percent: number, message?: string): void {
    const job = this.jobs.get(jobId)
    if (!job || job.status !== 'running') return

    const clampedPercent = Math.min(100, Math.max(0, Math.round(percent)))
    const progress: JobProgress = {
      percent: clampedPercent,
      message,
      updatedAt: Date.now(),
    }
    job.progress = progress
    this.emitEvent('job:progress', job)
  }

  private emitEvent(type: JobEventType, job: JobRecord<unknown, unknown>): void {
    const payload = {
      type,
      jobId: job.id,
      jobName: job.name,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
      timestamp: Date.now(),
    }

    for (const listener of this.listeners) {
      try {
        listener(payload)
      } catch {
        // Listener errors do not disrupt the job loop
      }
    }
  }
}

/**
 * Shared singleton instance for application-wide local job execution.
 */
export const sharedJobQueue = new LocalJobQueue({
  concurrency: 3,
  pollIntervalMs: 100,
})
