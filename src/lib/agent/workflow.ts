/**
 * Bounded Agent Workflow Engine with Checkpoints, Resumability & Verification
 * 
 * Capabilities:
 * - Deterministic, step-by-step execution pipeline (e.g. Plan -> Execute -> Verify)
 * - Strict bounding: hard maximum step count to prevent infinite loops
 * - Real timeout interruption using Promise.race (does not hang on slow steps)
 * - Cancellation support via AbortSignal
 * - Configuration validation and step definition guards
 * - Versioned checkpoints and resumability with custom storage adapters
 * - Side-effect protection: detects uncertain execution to prevent duplicate writes/transactions
 * - Post-execution verification distinguishing passed, failed, and inconclusive checks
 * - Structured telemetry and sanitized event hooks for real-time observability
 */

import {
  CHECKPOINT_SCHEMA_VERSION,
  validateCheckpoint,
  emitSanitizedEvent,
  type WorkflowCheckpoint,
  type WorkflowCheckpointStorage,
  type VerificationResult,
  type WorkflowEventListener,
} from './checkpoint'

export type WorkflowStopReason =
  | 'completed'
  | 'max_iterations'
  | 'timeout'
  | 'cancelled'
  | 'error'

export interface StepExecutionContext {
  signal?: AbortSignal
}

export interface StepResult<TContext> {
  success: boolean
  nextStepId?: string | null
  error?: string
  patchContext?: Partial<TContext>
}

export interface WorkflowStep<TContext> {
  id: string
  name: string
  execute: (
    context: Readonly<TContext>,
    execContext?: StepExecutionContext
  ) => Promise<StepResult<TContext>> | StepResult<TContext>
  /** Optional verification function run after execution to prove intended effect occurred */
  verify?: (
    context: Readonly<TContext>,
    execContext?: StepExecutionContext
  ) => Promise<VerificationResult | boolean> | VerificationResult | boolean
  maxRetries?: number
  /** Maximum verification retry attempts (default: 1, max: 5) */
  maxVerificationRetries?: number
  /** Whether the step is read-only (false = mutating side-effect like write/payment/email) */
  isReadOnly?: boolean
  /** Optional per-step timeout in milliseconds */
  timeoutMs?: number
}

export interface WorkflowStepLog {
  stepId: string
  stepName: string
  attempts: number
  durationMs: number
  success: boolean
  error?: string
  verification?: VerificationResult
}

export interface WorkflowRunResult<TContext> {
  success: boolean
  stopReason: WorkflowStopReason
  workflowId: string
  completedSteps: WorkflowStepLog[]
  totalDurationMs: number
  totalIterations: number
  context: TContext
  finalStepId: string | null
  error?: string
  checkpoint?: WorkflowCheckpoint<TContext>
}

export interface WorkflowOptions<TContext extends Record<string, unknown> = Record<string, unknown>> {
  /** Hard cap on total step executions to prevent runaway loops (default: 15, max: 50) */
  maxIterations?: number
  /** Overall workflow timeout in milliseconds (default: 30,000ms) */
  timeoutMs?: number
  /** Optional cancellation signal */
  signal?: AbortSignal
  /** Unique workflow instance ID (auto-generated if omitted) */
  workflowId?: string
  /** Version tag for the workflow pipeline definition to detect breaking modifications */
  workflowVersion?: string
  /** Optional storage adapter for saving/resuming state checkpoints */
  storage?: WorkflowCheckpointStorage<TContext>
  /** Policy when resuming from an existing checkpoint: 'resume' (default) or 'restart' */
  resumePolicy?: 'resume' | 'restart'
  /**
   * If false (default), refuses to resume if an in-flight side-effecting step was interrupted
   * without confirmed completion.
   */
  allowResumeUncertainSideEffects?: boolean
  /** Optional event listener for progress monitoring (automatically sanitizes secrets) */
  onEvent?: WorkflowEventListener<TContext>
}

function raceWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage: string
): Promise<T> {
  let timer: NodeJS.Timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMessage)), ms)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer)
  })
}

export class BoundedWorkflow<TContext extends Record<string, unknown>> {
  private steps = new Map<string, WorkflowStep<TContext>>()
  private initialStepId: string | null = null

  addStep(step: WorkflowStep<TContext>): this {
    if (!step || typeof step !== 'object') {
      throw new Error('Workflow step must be an object.')
    }
    if (!step.id || typeof step.id !== 'string' || step.id.trim() === '') {
      throw new Error('Workflow step must have a non-empty string id.')
    }
    if (!step.name || typeof step.name !== 'string' || step.name.trim() === '') {
      throw new Error('Workflow step must have a non-empty string name.')
    }
    if (typeof step.execute !== 'function') {
      throw new Error(`Workflow step '${step.id}' must provide an execute function.`)
    }
    if (this.steps.has(step.id)) {
      throw new Error(`Workflow already has a step with id '${step.id}'. Step IDs must be unique.`)
    }

    this.steps.set(step.id, step)
    if (!this.initialStepId) {
      this.initialStepId = step.id
    }
    return this
  }

  async run(
    initialContext: TContext,
    options: WorkflowOptions<TContext> = {}
  ): Promise<WorkflowRunResult<TContext>> {
    const rawMaxIterations = options.maxIterations ?? 15
    const maxIterations = Math.min(Math.max(1, rawMaxIterations), 50)
    const timeoutMs = Math.max(10, options.timeoutMs ?? 30000)
    const signal = options.signal
    const workflowId = options.workflowId ?? `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const storage = options.storage
    const resumePolicy = options.resumePolicy ?? 'resume'
    const allowResumeUncertainSideEffects = options.allowResumeUncertainSideEffects ?? false
    const onEvent = options.onEvent

    const startTime = Date.now()
    let completedSteps: WorkflowStepLog[] = []
    let currentContext = { ...initialContext }
    let currentStepId = this.initialStepId
    let iterationCount = 0

    emitSanitizedEvent(onEvent, {
      type: 'workflow_started',
      workflowId,
      timestamp: startTime,
      context: currentContext,
    })

    if (!currentStepId) {
      emitSanitizedEvent(onEvent, {
        type: 'workflow_failed',
        workflowId,
        timestamp: Date.now(),
        error: 'Workflow has no registered steps.',
      })
      return {
        success: false,
        stopReason: 'error',
        workflowId,
        completedSteps: [],
        totalDurationMs: 0,
        totalIterations: 0,
        context: currentContext,
        finalStepId: null,
        error: 'Workflow has no registered steps.',
      }
    }

    // 1. Checkpoint Restoration (if storage configured)
    if (storage) {
      try {
        const rawCheckpoint = await storage.loadCheckpoint(workflowId)
        if (rawCheckpoint) {
          const validation = validateCheckpoint<TContext>(rawCheckpoint, options.workflowVersion)
          if (!validation.valid) {
            emitSanitizedEvent(onEvent, {
              type: 'workflow_failed',
              workflowId,
              timestamp: Date.now(),
              error: `Invalid checkpoint: ${validation.error}`,
            })
            return {
              success: false,
              stopReason: 'error',
              workflowId,
              completedSteps: [],
              totalDurationMs: Date.now() - startTime,
              totalIterations: 0,
              context: currentContext,
              finalStepId: null,
              error: `Cannot resume workflow: ${validation.error}`,
            }
          }

          const cp = validation.checkpoint
          emitSanitizedEvent(onEvent, {
            type: 'checkpoint_loaded',
            workflowId,
            timestamp: Date.now(),
            checkpointVersion: cp.version,
            status: cp.status,
            context: cp.context,
          })

          if (resumePolicy === 'resume') {
            // Already completed
            if (cp.status === 'completed') {
              emitSanitizedEvent(onEvent, {
                type: 'workflow_completed',
                workflowId,
                timestamp: Date.now(),
                context: cp.context,
              })
              return {
                success: true,
                stopReason: 'completed',
                workflowId,
                completedSteps: cp.completedSteps,
                totalDurationMs: Date.now() - startTime,
                totalIterations: 0,
                context: cp.context,
                finalStepId: null,
                checkpoint: cp,
              }
            }

            // Side-effect safety check: do not resume if an uncertain side-effect step was interrupted
            if (cp.uncertainStepId && !allowResumeUncertainSideEffects) {
              const errorMsg = `Cannot safely resume workflow '${workflowId}': step '${cp.uncertainStepId}' is side-effecting and its completion status is uncertain. Pass allowResumeUncertainSideEffects: true to override.`
              emitSanitizedEvent(onEvent, {
                type: 'workflow_failed',
                workflowId,
                timestamp: Date.now(),
                error: errorMsg,
              })
              return {
                success: false,
                stopReason: 'error',
                workflowId,
                completedSteps: cp.completedSteps,
                totalDurationMs: Date.now() - startTime,
                totalIterations: 0,
                context: cp.context,
                finalStepId: cp.uncertainStepId,
                error: errorMsg,
                checkpoint: cp,
              }
            }

            // Restore state from checkpoint
            currentContext = { ...currentContext, ...cp.context }
            completedSteps = [...cp.completedSteps]
            currentStepId = cp.nextStepId
          }
        }
      } catch (err) {
        const errorMsg = `Checkpoint storage load failure: ${err instanceof Error ? err.message : String(err)}`
        emitSanitizedEvent(onEvent, {
          type: 'workflow_failed',
          workflowId,
          timestamp: Date.now(),
          error: errorMsg,
        })
        return {
          success: false,
          stopReason: 'error',
          workflowId,
          completedSteps,
          totalDurationMs: Date.now() - startTime,
          totalIterations: 0,
          context: currentContext,
          finalStepId: currentStepId,
          error: errorMsg,
        }
      }
    }

    // 2. Main Step Execution Loop
    while (currentStepId && iterationCount < maxIterations) {
      // Cancellation Check
      if (signal?.aborted) {
        emitSanitizedEvent(onEvent, {
          type: 'workflow_interrupted',
          workflowId,
          timestamp: Date.now(),
          status: 'cancelled',
        })
        return {
          success: false,
          stopReason: 'cancelled',
          workflowId,
          completedSteps,
          totalDurationMs: Date.now() - startTime,
          totalIterations: iterationCount,
          context: currentContext,
          finalStepId: currentStepId,
          error: 'Workflow was cancelled by signal.',
        }
      }

      // Timeout Check
      const elapsed = Date.now() - startTime
      const remainingTime = timeoutMs - elapsed
      if (remainingTime <= 0) {
        emitSanitizedEvent(onEvent, {
          type: 'workflow_failed',
          workflowId,
          timestamp: Date.now(),
          error: `Workflow timed out after ${timeoutMs}ms.`,
        })
        return {
          success: false,
          stopReason: 'timeout',
          workflowId,
          completedSteps,
          totalDurationMs: elapsed,
          totalIterations: iterationCount,
          context: currentContext,
          finalStepId: currentStepId,
          error: `Workflow timed out after ${timeoutMs}ms.`,
        }
      }

      // Resolve Current Step
      const step = this.steps.get(currentStepId)
      if (!step) {
        const errorMsg = `Unknown step ID: ${currentStepId}`
        emitSanitizedEvent(onEvent, {
          type: 'workflow_failed',
          workflowId,
          timestamp: Date.now(),
          error: errorMsg,
        })
        return {
          success: false,
          stopReason: 'error',
          workflowId,
          completedSteps,
          totalDurationMs: Date.now() - startTime,
          totalIterations: iterationCount,
          context: currentContext,
          finalStepId: currentStepId,
          error: errorMsg,
        }
      }

      iterationCount++
      const stepStart = Date.now()
      let attempts = 0
      const maxRetries = Math.max(0, step.maxRetries ?? 0)
      let stepSuccess = false
      let stepError: string | undefined
      let nextStepId: string | null | undefined = null
      let verificationResult: VerificationResult | undefined

      emitSanitizedEvent(onEvent, {
        type: 'step_started',
        workflowId,
        timestamp: stepStart,
        stepId: step.id,
        stepName: step.name,
      })

      // Pre-step checkpoint for mutating (side-effecting) steps to mark uncertain status
      if (step.isReadOnly === false && storage) {
        try {
          const preStepCheckpoint: WorkflowCheckpoint<TContext> = {
            version: CHECKPOINT_SCHEMA_VERSION,
            workflowId,
            workflowVersion: options.workflowVersion,
            nextStepId: currentStepId,
            completedSteps,
            context: currentContext,
            status: 'running',
            updatedAt: Date.now(),
            uncertainStepId: step.id,
          }
          await storage.saveCheckpoint(preStepCheckpoint)
          emitSanitizedEvent(onEvent, {
            type: 'checkpoint_saved',
            workflowId,
            timestamp: Date.now(),
            stepId: step.id,
            checkpointVersion: CHECKPOINT_SCHEMA_VERSION,
          })
        } catch (err) {
          return {
            success: false,
            stopReason: 'error',
            workflowId,
            completedSteps,
            totalDurationMs: Date.now() - startTime,
            totalIterations: iterationCount,
            context: currentContext,
            finalStepId: currentStepId,
            error: `Failed saving pre-step checkpoint: ${err instanceof Error ? err.message : String(err)}`,
          }
        }
      }

      const stepTimeoutBudget = step.timeoutMs ? Math.min(step.timeoutMs, remainingTime) : remainingTime

      while (attempts <= maxRetries && !stepSuccess) {
        if (signal?.aborted) {
          stepError = 'Execution cancelled.'
          break
        }

        attempts++
        try {
          const stepPromise = Promise.resolve(step.execute(currentContext, { signal }))
          const result = await raceWithTimeout(
            stepPromise,
            stepTimeoutBudget,
            `Step '${step.name}' timed out after ${stepTimeoutBudget}ms.`
          )

          if (result.success) {
            // Context candidate update
            const candidateContext = result.patchContext
              ? { ...currentContext, ...result.patchContext }
              : { ...currentContext }

            // Post-execution verification (if defined)
            if (step.verify) {
              emitSanitizedEvent(onEvent, {
                type: 'verification_started',
                workflowId,
                timestamp: Date.now(),
                stepId: step.id,
                stepName: step.name,
              })

              const verifyStart = Date.now()
              const maxVerifyRetries = Math.min(Math.max(0, step.maxVerificationRetries ?? 1), 5)
              let verifyAttempts = 0
              verificationResult = { outcome: 'inconclusive' }

              while (verifyAttempts <= maxVerifyRetries) {
                verifyAttempts++
                const verifyRemaining = Math.max(10, stepTimeoutBudget - (Date.now() - stepStart))
                try {
                  const vPromise = Promise.resolve(step.verify(candidateContext, { signal }))
                  const vRes = await raceWithTimeout(
                    vPromise,
                    verifyRemaining,
                    `Verification for step '${step.name}' timed out after ${verifyRemaining}ms.`
                  )

                  if (typeof vRes === 'boolean') {
                    verificationResult = {
                      outcome: vRes ? 'passed' : 'failed',
                      details: vRes ? undefined : 'Step verification check returned false.',
                      attempts: verifyAttempts,
                      durationMs: Date.now() - verifyStart,
                    }
                  } else {
                    verificationResult = {
                      ...vRes,
                      attempts: verifyAttempts,
                      durationMs: Date.now() - verifyStart,
                    }
                  }

                  if (verificationResult.outcome === 'passed') {
                    break
                  }
                } catch (vErr) {
                  verificationResult = {
                    outcome: 'inconclusive',
                    error: vErr instanceof Error ? vErr.message : String(vErr),
                    attempts: verifyAttempts,
                    durationMs: Date.now() - verifyStart,
                  }
                }
              }

              emitSanitizedEvent(onEvent, {
                type: 'verification_completed',
                workflowId,
                timestamp: Date.now(),
                stepId: step.id,
                stepName: step.name,
                verificationOutcome: verificationResult.outcome,
                durationMs: verificationResult.durationMs,
              })

              if (verificationResult.outcome === 'passed') {
                stepSuccess = true
                currentContext = candidateContext
                nextStepId = result.nextStepId
              } else if (verificationResult.outcome === 'failed') {
                stepSuccess = false
                stepError = `Step '${step.name}' execution succeeded but verification failed: ${
                  verificationResult.details || 'Verification returned failure.'
                }`
              } else {
                stepSuccess = false
                stepError = `Step '${step.name}' verification could not be completed: ${
                  verificationResult.error || 'Verification encountered an error.'
                }`
              }
            } else {
              // No verification configured; execution success is accepted
              stepSuccess = true
              currentContext = candidateContext
              nextStepId = result.nextStepId
              verificationResult = { outcome: 'skipped' }
            }
          } else {
            stepError = result.error || 'Step returned unsuccessful status'
            verificationResult = { outcome: 'skipped', error: 'Execution failed prior to verification' }
          }
        } catch (err) {
          stepError = err instanceof Error ? err.message : String(err)
          verificationResult = { outcome: 'skipped', error: stepError }
        }
      }

      completedSteps.push({
        stepId: step.id,
        stepName: step.name,
        attempts,
        durationMs: Date.now() - stepStart,
        success: stepSuccess,
        error: stepError,
        verification: verificationResult,
      })

      if (!stepSuccess) {
        const isTimeout = stepError?.includes('timed out')
        const isCancelled = signal?.aborted || stepError?.includes('cancelled')
        const stopReason: WorkflowStopReason = isCancelled
          ? 'cancelled'
          : isTimeout
          ? 'timeout'
          : 'error'

        emitSanitizedEvent(onEvent, {
          type: 'step_failed',
          workflowId,
          timestamp: Date.now(),
          stepId: step.id,
          stepName: step.name,
          error: stepError,
        })

        return {
          success: false,
          stopReason,
          workflowId,
          completedSteps,
          totalDurationMs: Date.now() - startTime,
          totalIterations: iterationCount,
          context: currentContext,
          finalStepId: currentStepId,
          error: `Step '${step.name}' failed after ${attempts} attempts: ${stepError}`,
        }
      }

      // If nextStepId is undefined, advance to the next registered step in insertion order
      if (nextStepId === undefined) {
        const stepKeys = Array.from(this.steps.keys())
        const currentIndex = stepKeys.indexOf(currentStepId)
        nextStepId = stepKeys[currentIndex + 1] ?? null
      }

      emitSanitizedEvent(onEvent, {
        type: 'step_completed',
        workflowId,
        timestamp: Date.now(),
        stepId: step.id,
        stepName: step.name,
        durationMs: Date.now() - stepStart,
        verificationOutcome: verificationResult?.outcome,
      })

      // Save checkpoint after successful step execution & verification
      if (storage) {
        try {
          const postStepCheckpoint: WorkflowCheckpoint<TContext> = {
            version: CHECKPOINT_SCHEMA_VERSION,
            workflowId,
            workflowVersion: options.workflowVersion,
            nextStepId,
            completedSteps,
            context: currentContext,
            status: 'running',
            updatedAt: Date.now(),
            uncertainStepId: null,
          }
          await storage.saveCheckpoint(postStepCheckpoint)
          emitSanitizedEvent(onEvent, {
            type: 'checkpoint_saved',
            workflowId,
            timestamp: Date.now(),
            stepId: step.id,
            checkpointVersion: CHECKPOINT_SCHEMA_VERSION,
          })
        } catch (err) {
          return {
            success: false,
            stopReason: 'error',
            workflowId,
            completedSteps,
            totalDurationMs: Date.now() - startTime,
            totalIterations: iterationCount,
            context: currentContext,
            finalStepId: currentStepId,
            error: `Failed saving post-step checkpoint: ${err instanceof Error ? err.message : String(err)}`,
          }
        }
      }

      currentStepId = nextStepId
    }

    // Bounded max iterations check
    if (currentStepId && iterationCount >= maxIterations) {
      const errorMsg = `Exceeded maximum allowed iterations (${maxIterations}). Loop bounded safely.`
      emitSanitizedEvent(onEvent, {
        type: 'workflow_failed',
        workflowId,
        timestamp: Date.now(),
        error: errorMsg,
      })
      return {
        success: false,
        stopReason: 'max_iterations',
        workflowId,
        completedSteps,
        totalDurationMs: Date.now() - startTime,
        totalIterations: iterationCount,
        context: currentContext,
        finalStepId: currentStepId,
        error: errorMsg,
      }
    }

    // Save final completed checkpoint
    let finalCheckpoint: WorkflowCheckpoint<TContext> | undefined
    if (storage) {
      try {
        finalCheckpoint = {
          version: CHECKPOINT_SCHEMA_VERSION,
          workflowId,
          workflowVersion: options.workflowVersion,
          nextStepId: null,
          completedSteps,
          context: currentContext,
          status: 'completed',
          updatedAt: Date.now(),
          uncertainStepId: null,
        }
        await storage.saveCheckpoint(finalCheckpoint)
      } catch {
        // Tolerated on final exit if storage fails after steps completed
      }
    }

    emitSanitizedEvent(onEvent, {
      type: 'workflow_completed',
      workflowId,
      timestamp: Date.now(),
      context: currentContext,
    })

    return {
      success: true,
      stopReason: 'completed',
      workflowId,
      completedSteps,
      totalDurationMs: Date.now() - startTime,
      totalIterations: iterationCount,
      context: currentContext,
      finalStepId: null,
      checkpoint: finalCheckpoint,
    }
  }
}
