/**
 * Provider-Neutral Background Jobs & Workflow Toolkit — Types & Contracts
 * 
 * References Studied:
 * - BullMQ (https://github.com/taskforcesh/bullmq) — Queues, Workers, Jobs, Backoff, Concurrency
 * - Inngest (https://github.com/inngest/inngest) — Step functions, durable execution, idempotent replays
 * - Temporal (https://github.com/temporalio/temporal) — Activity timeouts, checkpoints, failure compensation
 * - Trigger.dev (https://github.com/triggerdotdev/trigger.dev) — Task runs, schedules, progress telemetry
 */

export type JobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type BackoffStrategy = 'fixed' | 'exponential'

export interface RetryPolicy {
  /** Maximum number of retry attempts after initial failure (default: 0) */
  maxRetries: number
  /** Initial delay before the first retry in milliseconds (default: 1000) */
  backoffMs?: number
  /** Backoff algorithm: 'fixed' or 'exponential' (default: 'exponential') */
  strategy?: BackoffStrategy
  /** Exponential multiplier (default: 2) */
  backoffMultiplier?: number
  /**
   * Safety guard: If true, allows automatic retries even if the job is not explicitly marked idempotent.
   * If false or undefined, jobs without idempotency guarantees will NOT be automatically retried.
   */
  nonIdempotentSafe?: boolean
}

export interface EnqueueOptions {
  /** Execution priority (higher numbers execute before lower numbers, default: 0) */
  priority?: number
  /** Delay in milliseconds before job becomes eligible for processing */
  delayMs?: number
  /** Absolute Unix timestamp (ms) when job should be processed */
  runAt?: number
  /** Maximum execution duration in milliseconds before timing out */
  timeoutMs?: number
  /** Custom retry policy for this specific job */
  retryPolicy?: RetryPolicy
  /** Idempotency key to suppress duplicate submissions */
  idempotencyKey?: string
  /**
   * Declares whether the job handler is safe to re-execute without duplicate side-effects.
   * Non-idempotent jobs (e.g. billing, outbound email) reject automatic retries unless nonIdempotentSafe is set.
   */
  isIdempotent?: boolean
  /** Optional metadata attached to the job record */
  metadata?: Record<string, unknown>
}

export interface JobProgress {
  percent: number
  message?: string
  stepId?: string
  updatedAt: number
}

export interface JobErrorDetail {
  message: string
  code?: string
  stack?: string
  attempt: number
  failedAt: number
  isFinal: boolean
}

export interface JobRecord<TData = unknown, TResult = unknown> {
  id: string
  name: string
  data: TData
  status: JobStatus
  priority: number
  runAt: number
  timeoutMs?: number
  retryPolicy: RetryPolicy
  isIdempotent: boolean
  idempotencyKey?: string
  attempts: number
  maxRetries: number
  progress?: JobProgress
  result?: TResult
  error?: JobErrorDetail
  metadata?: Record<string, unknown>
  createdAt: number
  startedAt?: number
  finishedAt?: number
}

export type JobHandler<TData = unknown, TResult = unknown> = (
  job: JobRecord<TData, TResult>,
  context: JobExecutionContext
) => Promise<TResult> | TResult

export interface JobExecutionContext {
  signal: AbortSignal
  updateProgress: (percent: number, message?: string) => Promise<void> | void
  log: (message: string, details?: unknown) => void
}

export interface JobQueueStats {
  queued: number
  running: number
  completed: number
  failed: number
  cancelled: number
  total: number
}

export type JobEventType =
  | 'job:queued'
  | 'job:started'
  | 'job:progress'
  | 'job:completed'
  | 'job:failed'
  | 'job:cancelled'

export interface JobEventPayload {
  type: JobEventType
  jobId: string
  jobName: string
  status: JobStatus
  progress?: JobProgress
  result?: unknown
  error?: JobErrorDetail
  timestamp: number
}

export type JobEventListener = (event: JobEventPayload) => void

export interface IJobQueue {
  registerHandler<TData = unknown, TResult = unknown>(
    name: string,
    handler: JobHandler<TData, TResult>,
    defaultOptions?: Partial<EnqueueOptions>
  ): void
  enqueue<TData = unknown, TResult = unknown>(
    name: string,
    data: TData,
    options?: EnqueueOptions
  ): Promise<JobRecord<TData, TResult>>
  getJob<TData = unknown, TResult = unknown>(id: string): Promise<JobRecord<TData, TResult> | null>
  cancelJob(id: string): Promise<boolean>
  getStats(): Promise<JobQueueStats>
  start(): void
  stop(drainTimeoutMs?: number): Promise<void>
  on(listener: JobEventListener): () => void
}

// ============================================================================
// Workflow Orchestration Contracts
// ============================================================================

export interface WorkflowStepContext<TContext extends Record<string, unknown> = Record<string, unknown>> {
  context: Readonly<TContext>
  signal: AbortSignal
  reportProgress: (percent: number, message?: string) => void
}

export interface WorkflowStepOutcome<TContext extends Record<string, unknown> = Record<string, unknown>> {
  success: boolean
  patchContext?: Partial<TContext>
  error?: string
  skipRemaining?: boolean
  nextStepId?: string | null
}

export interface WorkflowStepDefinition<TContext extends Record<string, unknown> = Record<string, unknown>> {
  id: string
  name: string
  execute: (
    ctx: WorkflowStepContext<TContext>
  ) => Promise<WorkflowStepOutcome<TContext>> | WorkflowStepOutcome<TContext>
  /** Whether the step has mutating external side-effects (e.g. charging credit, sending email) */
  isMutating?: boolean
  /** Step timeout in milliseconds */
  timeoutMs?: number
  /** Max retries for this single step (default: 0) */
  maxRetries?: number
  /** Condition to evaluate before running step (returns false to skip step) */
  condition?: (context: Readonly<TContext>) => boolean | Promise<boolean>
}

export interface WorkflowExecutionResult<TContext extends Record<string, unknown> = Record<string, unknown>> {
  workflowId: string
  status: 'completed' | 'failed' | 'cancelled' | 'interrupted'
  context: TContext
  completedSteps: string[]
  currentStepId: string | null
  error?: string
  durationMs: number
}

// ============================================================================
// Recurring Job Schedules
// ============================================================================

export interface RecurringJobSchedule<TData = unknown> {
  id: string
  name: string
  data: TData
  /** Recurring interval in milliseconds */
  intervalMs?: number
  /** Standard 5-part cron pattern (minute hour dom month dow) */
  cronExpression?: string
  options?: EnqueueOptions
  lastRunAt?: number
  nextRunAt: number
  enabled: boolean
}
