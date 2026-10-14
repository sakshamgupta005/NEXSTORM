import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { BoundedWorkflow } from '@/lib/agent/workflow'
import { ToolRegistry } from '@/lib/agent/tools'
import {
  InMemoryCheckpointStorage,
  validateCheckpoint,
  type WorkflowCheckpoint,
  type WorkflowEvent,
} from '@/lib/agent/checkpoint'

interface TestContext extends Record<string, unknown> {
  stepCount: number
  plan?: string
  paymentProcessed?: boolean
  accountBalance?: number
  verified?: boolean
  secretKey?: string
}

describe('Workflow Checkpoints & Resumability', () => {
  it('creates checkpoints after each step and records completed steps', async () => {
    const storage = new InMemoryCheckpointStorage<TestContext>()
    const workflow = new BoundedWorkflow<TestContext>()

    workflow
      .addStep({
        id: 'step-1',
        name: 'Step 1',
        execute: () => ({ success: true, patchContext: { plan: 'Drafted' } }),
      })
      .addStep({
        id: 'step-2',
        name: 'Step 2',
        execute: () => ({ success: true, patchContext: { verified: true } }),
      })

    const runRes = await workflow.run(
      { stepCount: 0 },
      { workflowId: 'wf-checkpoint-1', storage }
    )

    expect(runRes.success).toBe(true)
    expect(storage.count).toBe(1) // 1 final completed checkpoint

    const loaded = await storage.loadCheckpoint('wf-checkpoint-1')
    expect(loaded).toBeDefined()
    expect(loaded?.status).toBe('completed')
    expect(loaded?.completedSteps.length).toBe(2)
    expect(loaded?.context.plan).toBe('Drafted')
    expect(loaded?.context.verified).toBe(true)
  })

  it('resumes from checkpoint without rerunning completed steps', async () => {
    const storage = new InMemoryCheckpointStorage<TestContext>()
    let step1ExecutionCount = 0
    let step2ExecutionCount = 0

    // Seed checkpoint after step 1
    const seededCheckpoint: WorkflowCheckpoint<TestContext> = {
      version: 1,
      workflowId: 'wf-resumable',
      nextStepId: 'step-2',
      completedSteps: [
        {
          stepId: 'step-1',
          stepName: 'Step 1',
          attempts: 1,
          durationMs: 15,
          success: true,
        },
      ],
      context: { stepCount: 1, plan: 'Saved Plan' },
      status: 'running',
      updatedAt: Date.now(),
      uncertainStepId: null,
    }
    await storage.saveCheckpoint(seededCheckpoint)

    const workflow = new BoundedWorkflow<TestContext>()
    workflow
      .addStep({
        id: 'step-1',
        name: 'Step 1',
        execute: () => {
          step1ExecutionCount++
          return { success: true }
        },
      })
      .addStep({
        id: 'step-2',
        name: 'Step 2',
        execute: (ctx) => {
          step2ExecutionCount++
          return { success: true, patchContext: { stepCount: ctx.stepCount + 1 } }
        },
      })

    const res = await workflow.run(
      { stepCount: 0 },
      { workflowId: 'wf-resumable', storage }
    )

    expect(res.success).toBe(true)
    expect(step1ExecutionCount).toBe(0) // Step 1 was skipped because it was already completed!
    expect(step2ExecutionCount).toBe(1) // Step 2 was executed
    expect(res.context.plan).toBe('Saved Plan')
    expect(res.context.stepCount).toBe(2)
    expect(res.completedSteps.length).toBe(2)
  })

  it('rejects corrupt and incompatible checkpoints safely', async () => {
    const storage = new InMemoryCheckpointStorage<TestContext>()

    // 1. Incompatible schema version
    storage.saveCheckpoint({
      version: 999, // Unknown future version
      workflowId: 'wf-bad-version',
      nextStepId: 'step-1',
      completedSteps: [],
      context: { stepCount: 0 },
      status: 'running',
      updatedAt: Date.now(),
    })

    const workflow = new BoundedWorkflow<TestContext>()
    workflow.addStep({ id: 'step-1', name: 'Step 1', execute: () => ({ success: true }) })

    const res1 = await workflow.run({ stepCount: 0 }, { workflowId: 'wf-bad-version', storage })
    expect(res1.success).toBe(false)
    expect(res1.error).toContain('Incompatible checkpoint schema version')

    // 2. Corrupt checkpoint structure
    const corruptValidation = validateCheckpoint({ version: 1, context: 'not-an-object' })
    expect(corruptValidation.valid).toBe(false)
    if (!corruptValidation.valid) {
      expect(corruptValidation.errorCode).toBe('CORRUPTED')
    }

    // 3. Incompatible workflow version
    const wfVersionMismatch = validateCheckpoint(
      {
        version: 1,
        workflowId: 'wf-v1',
        workflowVersion: 'v1.0.0',
        completedSteps: [],
        context: {},
      },
      'v2.0.0'
    )
    expect(wfVersionMismatch.valid).toBe(false)
    if (!wfVersionMismatch.valid) {
      expect(wfVersionMismatch.errorCode).toBe('INCOMPATIBLE_WORKFLOW')
    }
  })

  it('safely prevents resuming side-effecting steps in uncertain state', async () => {
    const storage = new InMemoryCheckpointStorage<TestContext>()
    let chargeExecutionCount = 0

    // Simulate process crash during a payment
    storage.saveCheckpoint({
      version: 1,
      workflowId: 'wf-crashed-payment',
      nextStepId: 'charge-card',
      completedSteps: [],
      context: { stepCount: 0 },
      status: 'running',
      updatedAt: Date.now(),
      uncertainStepId: 'charge-card', // Crashed in-flight
    })

    const workflow = new BoundedWorkflow<TestContext>()
    workflow.addStep({
      id: 'charge-card',
      name: 'Charge Credit Card',
      isReadOnly: false, // Mutating side-effect
      execute: () => {
        chargeExecutionCount++
        return { success: true }
      },
    })

    // Default safety: refuses to resume uncertain mutating step
    const safeRes = await workflow.run(
      { stepCount: 0 },
      { workflowId: 'wf-crashed-payment', storage, allowResumeUncertainSideEffects: false }
    )
    expect(safeRes.success).toBe(false)
    expect(safeRes.error).toContain("is side-effecting and its completion status is uncertain")
    expect(chargeExecutionCount).toBe(0)

    // Explicit override permitted when application confirms safety
    const overrideRes = await workflow.run(
      { stepCount: 0 },
      { workflowId: 'wf-crashed-payment', storage, allowResumeUncertainSideEffects: true }
    )
    expect(overrideRes.success).toBe(true)
    expect(chargeExecutionCount).toBe(1)
  })

  it('handles storage adapter failure gracefully', async () => {
    const failingStorage = {
      saveCheckpoint: () => {
        throw new Error('Disk full')
      },
      loadCheckpoint: () => {
        throw new Error('Disk read error')
      },
    }

    const workflow = new BoundedWorkflow<TestContext>()
    workflow.addStep({ id: 'step-1', name: 'Step 1', execute: () => ({ success: true }) })

    const res = await workflow.run(
      { stepCount: 0 },
      { workflowId: 'wf-disk-fail', storage: failingStorage }
    )
    expect(res.success).toBe(false)
    expect(res.error).toContain('Checkpoint storage load failure: Disk read error')
  })
})

describe('Execution Verification', () => {
  it('distinguishes between execution success and verification pass/fail', async () => {
    const workflow = new BoundedWorkflow<TestContext>()

    workflow.addStep({
      id: 'create-account',
      name: 'Create Account',
      execute: () => ({
        success: true,
        patchContext: { accountBalance: 0 },
      }),
      // Verification confirms account balance is greater than 0
      verify: (ctx) => ({
        outcome: (ctx.accountBalance ?? 0) > 0 ? 'passed' : 'failed',
        details: 'Account balance must be positive after creation.',
      }),
    })

    const res = await workflow.run({ stepCount: 0, accountBalance: 0 })

    expect(res.success).toBe(false)
    expect(res.error).toContain('execution succeeded but verification failed')
    expect(res.completedSteps[0]?.verification?.outcome).toBe('failed')
  })

  it('passes when both execution and verification succeed', async () => {
    const workflow = new BoundedWorkflow<TestContext>()

    workflow.addStep({
      id: 'fund-account',
      name: 'Fund Account',
      execute: () => ({
        success: true,
        patchContext: { accountBalance: 150 },
      }),
      verify: (ctx) => (ctx.accountBalance ?? 0) >= 100,
    })

    const res = await workflow.run({ stepCount: 0 })

    expect(res.success).toBe(true)
    expect(res.completedSteps[0]?.verification?.outcome).toBe('passed')
  })

  it('marks verification inconclusive when verify check errors or times out', async () => {
    const workflow = new BoundedWorkflow<TestContext>()

    workflow.addStep({
      id: 'external-audit',
      name: 'External Audit',
      execute: () => ({ success: true }),
      verify: () => {
        throw new Error('Audit service unavailable')
      },
    })

    const res = await workflow.run({ stepCount: 0 })

    expect(res.success).toBe(false)
    expect(res.error).toContain('verification could not be completed')
    expect(res.completedSteps[0]?.verification?.outcome).toBe('inconclusive')
  })

  it('respects bounded verification retries', async () => {
    const workflow = new BoundedWorkflow<TestContext>()
    let verifyCallCount = 0

    workflow.addStep({
      id: 'flaky-verify',
      name: 'Flaky Verify',
      maxVerificationRetries: 2,
      execute: () => ({ success: true }),
      verify: () => {
        verifyCallCount++
        return { outcome: 'failed', details: 'Check failed attempt ' + verifyCallCount }
      },
    })

    const res = await workflow.run({ stepCount: 0 })

    expect(res.success).toBe(false)
    expect(verifyCallCount).toBe(3) // Initial attempt + 2 retries
  })

  it('verifies tool post-execution with ToolRegistry', async () => {
    const registry = new ToolRegistry()

    registry.register({
      name: 'update_record',
      description: 'Updates a database record',
      parameters: z.object({ id: z.string(), status: z.string() }),
      execute: ({ id, status }) => ({ id, status, updated: true }),
      verify: (result) => {
        const record = result as { status?: string }
        return record.status === 'active'
      },
    })

    // 1. Verification fails when returned status is pending
    const failRes = await registry.execute('update_record', { id: 'rec-1', status: 'pending' })
    expect(failRes.success).toBe(false)
    expect(failRes.errorCode).toBe('VERIFICATION_FAILED')
    expect(failRes.verification?.outcome).toBe('failed')

    // 2. Verification passes when status is active
    const passRes = await registry.execute('update_record', { id: 'rec-1', status: 'active' })
    expect(passRes.success).toBe(true)
    expect(passRes.verification?.outcome).toBe('passed')
  })
})

describe('Observability & Event Sanitization', () => {
  it('emits sanitized workflow events without leaking secrets', async () => {
    const events: WorkflowEvent<TestContext>[] = []
    const workflow = new BoundedWorkflow<TestContext>()

    workflow.addStep({
      id: 'step-1',
      name: 'Step 1',
      execute: () => ({ success: true }),
    })

    await workflow.run(
      { stepCount: 0, secretKey: 'super-secret-api-token' },
      {
        workflowId: 'wf-events',
        onEvent: (event) => events.push(event),
      }
    )

    expect(events.length).toBeGreaterThan(0)
    const startedEvent = events.find((e) => e.type === 'workflow_started')
    expect(startedEvent).toBeDefined()
    expect(startedEvent?.context?.secretKey).toBe('[REDACTED]') // Secrets masked!
    expect(startedEvent?.context?.stepCount).toBe(0)
  })
})
