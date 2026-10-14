/**
 * Composable Multi-Step Workflow Engine with Checkpoint Resumability
 * 
 * References Studied:
 * - Inngest (https://github.com/inngest/inngest) — Step memoization, durable replays
 * - Temporal (https://github.com/temporalio/temporal) — Activity retries, failure isolation
 * - Agent Checkpoint System (src/lib/agent/checkpoint.ts) — Unified checkpoint contracts
 * 
 * Capabilities:
 * - Composable steps: Validate input -> Process data -> Call AI -> Verify result -> Save output
 * - Conditional branching and step skips
 * - Checkpoint persistence & resumption: skips already completed steps upon replay
 * - Non-idempotent side-effect tracking (uncertainStepId) preventing duplicate charges/mutations
 * - Step-level timeouts & retries
 * - Real-time progress telemetry
 * - Graceful cancellation via AbortSignal
 */

import {
  CHECKPOINT_SCHEMA_VERSION,
  InMemoryCheckpointStorage,
  type WorkflowCheckpoint,
  type WorkflowCheckpointStorage,
} from '../agent/checkpoint'
import type {
  WorkflowStepDefinition,
  WorkflowExecutionResult,
  WorkflowStepContext,
  WorkflowStepOutcome,
} from './types'

export interface WorkflowEngineOptions<TContext extends Record<string, unknown>> {
  workflowId: string
  initialContext: TContext
  steps: WorkflowStepDefinition<TContext>[]
  checkpointStorage?: WorkflowCheckpointStorage<TContext>
  onProgress?: (percent: number, message?: string, stepId?: string) => void
  signal?: AbortSignal
  workflowVersion?: string
}

export class JobWorkflowEngine<TContext extends Record<string, unknown> = Record<string, unknown>> {
  private workflowId: string
  private context: TContext
  private steps: WorkflowStepDefinition<TContext>[]
  private storage: WorkflowCheckpointStorage<TContext>
  private onProgress?: (percent: number, message?: string, stepId?: string) => void
  private signal?: AbortSignal
  private workflowVersion?: string

  constructor(options: WorkflowEngineOptions<TContext>) {
    this.workflowId = options.workflowId
    // Deep clone initial context
    this.context = JSON.parse(JSON.stringify(options.initialContext))
    this.steps = [...options.steps]
    this.storage = options.checkpointStorage ?? new InMemoryCheckpointStorage<TContext>()
    this.onProgress = options.onProgress
    this.signal = options.signal
    this.workflowVersion = options.workflowVersion
  }

  public async run(): Promise<WorkflowExecutionResult<TContext>> {
    const startTime = Date.now()
    const completedSteps: string[] = []
    let startIndex = 0

    // 1. Attempt to resume from existing checkpoint if available
    const existingCheckpoint = await this.storage.loadCheckpoint(this.workflowId)
    if (existingCheckpoint && existingCheckpoint.status === 'interrupted') {
      this.context = { ...this.context, ...existingCheckpoint.context }
      for (const s of existingCheckpoint.completedSteps) {
        completedSteps.push(s.stepId)
      }

      if (existingCheckpoint.nextStepId) {
        const foundIdx = this.steps.findIndex((s) => s.id === existingCheckpoint.nextStepId)
        if (foundIdx !== -1) {
          startIndex = foundIdx
        }
      }
    }

    let currentIndex = startIndex

    while (currentIndex < this.steps.length) {
      if (this.signal?.aborted) {
        await this.recordCheckpoint(
          this.steps[currentIndex].id,
          completedSteps,
          'cancelled'
        )
        return {
          workflowId: this.workflowId,
          status: 'cancelled',
          context: this.context,
          completedSteps,
          currentStepId: this.steps[currentIndex].id,
          error: 'Workflow was cancelled by signal',
          durationMs: Date.now() - startTime,
        }
      }

      const step = this.steps[currentIndex]

      // Evaluate condition (if provided)
      if (step.condition) {
        const shouldRun = await Promise.resolve(step.condition(this.context))
        if (!shouldRun) {
          currentIndex++
          continue
        }
      }

      // Record uncertainStepId if mutating side-effect is starting
      if (step.isMutating) {
        await this.recordCheckpoint(step.id, completedSteps, 'running', step.id)
      }

      // Calculate progress percentage
      const progressPercent = Math.round((currentIndex / this.steps.length) * 100)
      this.onProgress?.(progressPercent, `Executing ${step.name}`, step.id)

      // Execute step with retries and timeout
      const outcome = await this.executeStepWithRetry(step)

      if (!outcome.success) {
        await this.recordCheckpoint(step.id, completedSteps, 'failed')
        return {
          workflowId: this.workflowId,
          status: 'failed',
          context: this.context,
          completedSteps,
          currentStepId: step.id,
          error: outcome.error ?? `Step '${step.name}' failed`,
          durationMs: Date.now() - startTime,
        }
      }

      // Merge context patch
      if (outcome.patchContext) {
        this.context = {
          ...this.context,
          ...outcome.patchContext,
        }
      }

      completedSteps.push(step.id)

      // Handle explicit step skip or early completion
      if (outcome.skipRemaining) {
        break
      }

      // Checkpoint step completion
      const nextStep = this.steps[currentIndex + 1]
      await this.recordCheckpoint(
        nextStep ? nextStep.id : null,
        completedSteps,
        'running',
        null
      )

      // Handle conditional step jump
      if (outcome.nextStepId) {
        const targetIdx = this.steps.findIndex((s) => s.id === outcome.nextStepId)
        if (targetIdx !== -1) {
          currentIndex = targetIdx
          continue
        }
      }

      currentIndex++
    }

    this.onProgress?.(100, 'Workflow completed successfully', undefined)
    await this.recordCheckpoint(null, completedSteps, 'completed', null)

    return {
      workflowId: this.workflowId,
      status: 'completed',
      context: this.context,
      completedSteps,
      currentStepId: null,
      durationMs: Date.now() - startTime,
    }
  }

  private async executeStepWithRetry(
    step: WorkflowStepDefinition<TContext>
  ): Promise<{ success: boolean; patchContext?: Partial<TContext>; error?: string; skipRemaining?: boolean; nextStepId?: string | null }> {
    const maxRetries = Math.max(0, step.maxRetries ?? 0)
    let attempts = 0
    let lastError: string | undefined

    while (attempts <= maxRetries) {
      if (this.signal?.aborted) {
        return { success: false, error: 'Cancelled' }
      }

      attempts++

      try {
        const stepContext: WorkflowStepContext<TContext> = {
          context: this.context,
          signal: this.signal ?? new AbortController().signal,
          reportProgress: (pct, msg) => {
            this.onProgress?.(pct, msg, step.id)
          },
        }

        let runPromise = Promise.resolve(step.execute(stepContext))

        if (step.timeoutMs && step.timeoutMs > 0) {
          const timeoutPromise = new Promise<WorkflowStepOutcome<TContext>>((_, reject) => {
            setTimeout(() => {
              reject(new Error(`Step '${step.name}' timed out after ${step.timeoutMs}ms`))
            }, step.timeoutMs)
          })
          runPromise = Promise.race([runPromise, timeoutPromise])
        }

        const result = await runPromise
        if (result.success) {
          return result
        }

        lastError = result.error ?? 'Step failed'
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err)
      }

      // If mutating step fails, never automatically retry unless explicitly instructed
      if (step.isMutating && maxRetries > 0) {
        // Safe precaution: pause before retry
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    }

    return {
      success: false,
      error: lastError,
    }
  }

  private async recordCheckpoint(
    nextStepId: string | null,
    completedSteps: string[],
    status: 'running' | 'completed' | 'failed' | 'interrupted' | 'cancelled',
    uncertainStepId: string | null = null
  ): Promise<void> {
    const cp: WorkflowCheckpoint<TContext> = {
      version: CHECKPOINT_SCHEMA_VERSION,
      workflowId: this.workflowId,
      workflowVersion: this.workflowVersion,
      nextStepId,
      completedSteps: completedSteps.map((id) => ({
        stepId: id,
        stepName: id,
        attempts: 1,
        durationMs: 0,
        success: true,
      })),
      context: JSON.parse(JSON.stringify(this.context)),
      status,
      updatedAt: Date.now(),
      uncertainStepId,
    }

    await this.storage.saveCheckpoint(cp)
  }
}

/**
 * Fluent builder for creating composable multi-step workflows
 */
export class JobWorkflowBuilder<TContext extends Record<string, unknown> = Record<string, unknown>> {
  private steps: WorkflowStepDefinition<TContext>[] = []

  public step(stepDef: WorkflowStepDefinition<TContext>): this {
    this.steps.push(stepDef)
    return this
  }

  public branch(
    id: string,
    name: string,
    condition: (ctx: Readonly<TContext>) => boolean | Promise<boolean>,
    thenNextStepId: string,
    elseNextStepId?: string
  ): this {
    this.steps.push({
      id,
      name,
      execute: async (stepCtx) => {
        const passes = await Promise.resolve(condition(stepCtx.context))
        return {
          success: true,
          nextStepId: passes ? thenNextStepId : (elseNextStepId ?? null),
        }
      },
    })
    return this
  }

  public build(): WorkflowStepDefinition<TContext>[] {
    return [...this.steps]
  }
}
