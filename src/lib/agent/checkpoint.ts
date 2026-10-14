/**
 * Workflow Checkpoints, Resumability & Execution Verification
 * 
 * Capabilities:
 * - Versioned checkpoint serialization and structural validation
 * - In-memory and pluggable checkpoint storage adapters
 * - Side-effect safety tracking (uncertainStepId) to prevent duplicate external actions
 * - Multi-state execution verification (passed, failed, inconclusive, skipped)
 * - Safe observable event bus for workflow monitoring without leaking secrets
 */

import type { WorkflowStepLog } from './workflow'
import { sanitizeContextForPrompt } from './loop'

export const CHECKPOINT_SCHEMA_VERSION = 1

export type VerificationOutcome =
  | 'passed'
  | 'failed'
  | 'inconclusive'
  | 'skipped'

export interface VerificationResult {
  outcome: VerificationOutcome
  details?: string
  error?: string
  attempts?: number
  durationMs?: number
}

export interface WorkflowCheckpoint<TContext = Record<string, unknown>> {
  /** Schema version for forward/backward compatibility checks */
  version: number
  /** Unique identifier for the workflow execution instance */
  workflowId: string
  /** Optional application-defined version string for the workflow pipeline definition */
  workflowVersion?: string
  /** Next step queued to execute, or null if workflow has concluded */
  nextStepId: string | null
  /** Log of steps that completed successfully */
  completedSteps: WorkflowStepLog[]
  /** Snapshot of the accumulated workflow context */
  context: TContext
  /** Overall workflow lifecycle status */
  status: 'running' | 'completed' | 'failed' | 'interrupted' | 'cancelled'
  /** Unix timestamp when this checkpoint was written */
  updatedAt: number
  /** Set to step ID while a non-readonly (side-effecting) step is in-flight */
  uncertainStepId?: string | null
}

export interface WorkflowCheckpointStorage<TContext extends Record<string, unknown> = Record<string, unknown>> {
  saveCheckpoint(checkpoint: WorkflowCheckpoint<TContext>): Promise<void> | void
  loadCheckpoint(workflowId: string): Promise<WorkflowCheckpoint<TContext> | null> | WorkflowCheckpoint<TContext> | null
  deleteCheckpoint?(workflowId: string): Promise<void> | void
}

export type CheckpointValidationError =
  | 'CORRUPTED'
  | 'INCOMPATIBLE_VERSION'
  | 'INCOMPATIBLE_WORKFLOW'

export interface CheckpointValidationSuccess<TContext> {
  valid: true
  checkpoint: WorkflowCheckpoint<TContext>
}

export interface CheckpointValidationFailure {
  valid: false
  error: string
  errorCode: CheckpointValidationError
}

export type CheckpointValidationResult<TContext> =
  | CheckpointValidationSuccess<TContext>
  | CheckpointValidationFailure

/**
 * Validates checkpoint data structure, schema version, and workflow definition compatibility.
 */
export function validateCheckpoint<TContext extends Record<string, unknown> = Record<string, unknown>>(
  raw: unknown,
  expectedWorkflowVersion?: string
): CheckpointValidationResult<TContext> {
  if (!raw || typeof raw !== 'object') {
    return {
      valid: false,
      error: 'Checkpoint payload must be a non-null object.',
      errorCode: 'CORRUPTED',
    }
  }

  const cp = raw as Partial<WorkflowCheckpoint<TContext>>

  if (typeof cp.version !== 'number' || cp.version !== CHECKPOINT_SCHEMA_VERSION) {
    return {
      valid: false,
      error: `Incompatible checkpoint schema version: expected ${CHECKPOINT_SCHEMA_VERSION}, received ${String(cp.version)}.`,
      errorCode: 'INCOMPATIBLE_VERSION',
    }
  }

  if (!cp.workflowId || typeof cp.workflowId !== 'string' || cp.workflowId.trim() === '') {
    return {
      valid: false,
      error: 'Checkpoint missing valid string workflowId.',
      errorCode: 'CORRUPTED',
    }
  }

  if (!cp.context || typeof cp.context !== 'object' || Array.isArray(cp.context)) {
    return {
      valid: false,
      error: 'Checkpoint missing valid context object.',
      errorCode: 'CORRUPTED',
    }
  }

  if (!Array.isArray(cp.completedSteps)) {
    return {
      valid: false,
      error: 'Checkpoint missing valid completedSteps array.',
      errorCode: 'CORRUPTED',
    }
  }

  if (
    expectedWorkflowVersion &&
    cp.workflowVersion &&
    cp.workflowVersion !== expectedWorkflowVersion
  ) {
    return {
      valid: false,
      error: `Incompatible workflow definition version: expected '${expectedWorkflowVersion}', checkpoint was created with '${cp.workflowVersion}'.`,
      errorCode: 'INCOMPATIBLE_WORKFLOW',
    }
  }

  return {
    valid: true,
    checkpoint: cp as WorkflowCheckpoint<TContext>,
  }
}

/**
 * In-memory checkpoint storage for development and unit tests.
 */
export class InMemoryCheckpointStorage<TContext extends Record<string, unknown> = Record<string, unknown>>
  implements WorkflowCheckpointStorage<TContext> {
  private checkpoints = new Map<string, WorkflowCheckpoint<TContext>>()

  saveCheckpoint(checkpoint: WorkflowCheckpoint<TContext>): void {
    // Deep clone to ensure external modifications do not corrupt stored snapshot
    this.checkpoints.set(checkpoint.workflowId, JSON.parse(JSON.stringify(checkpoint)))
  }

  loadCheckpoint(workflowId: string): WorkflowCheckpoint<TContext> | null {
    const cp = this.checkpoints.get(workflowId)
    if (!cp) return null
    return JSON.parse(JSON.stringify(cp))
  }

  deleteCheckpoint(workflowId: string): void {
    this.checkpoints.delete(workflowId)
  }

  clear(): void {
    this.checkpoints.clear()
  }

  get count(): number {
    return this.checkpoints.size
  }
}

export type WorkflowEventType =
  | 'workflow_started'
  | 'step_started'
  | 'step_completed'
  | 'step_failed'
  | 'verification_started'
  | 'verification_completed'
  | 'checkpoint_saved'
  | 'checkpoint_loaded'
  | 'workflow_completed'
  | 'workflow_interrupted'
  | 'workflow_failed'

export interface WorkflowEvent<TContext = Record<string, unknown>> {
  type: WorkflowEventType
  workflowId: string
  timestamp: number
  stepId?: string
  stepName?: string
  attempts?: number
  durationMs?: number
  checkpointVersion?: number
  status?: string
  verificationOutcome?: VerificationOutcome
  error?: string
  context?: Partial<TContext>
}

export type WorkflowEventListener<TContext = Record<string, unknown>> = (
  event: WorkflowEvent<TContext>
) => void

/**
 * Emits a sanitized workflow event to listeners, redacting sensitive tokens and secrets.
 */
export function emitSanitizedEvent<TContext extends Record<string, unknown>>(
  listener: WorkflowEventListener<TContext> | undefined,
  event: WorkflowEvent<TContext>
): void {
  if (!listener) return

  try {
    const safeEvent: WorkflowEvent<TContext> = {
      ...event,
      context: event.context
        ? (sanitizeContextForPrompt(event.context as Record<string, unknown>) as Partial<TContext>)
        : undefined,
    }
    listener(safeEvent)
  } catch {
    // Event listener exceptions should never crash the underlying workflow engine
  }
}
