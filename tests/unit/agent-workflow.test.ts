import { describe, it, expect } from 'vitest'
import { BoundedWorkflow } from '@/lib/agent/workflow'

interface DemoContext extends Record<string, unknown> {
  stepCount: number
  plan?: string
  executionResult?: string
  verified?: boolean
}

describe('BoundedWorkflow Engine', () => {
  it('runs linear workflow successfully across plan, execute, verify steps', async () => {
    const workflow = new BoundedWorkflow<DemoContext>()

    workflow
      .addStep({
        id: 'plan',
        name: 'Generate Plan',
        execute: () => ({
          success: true,
          patchContext: { plan: 'Step 1: Code, Step 2: Test' },
        }),
      })
      .addStep({
        id: 'execute',
        name: 'Execute Plan',
        execute: (ctx) => ({
          success: true,
          patchContext: { executionResult: `Executed: ${ctx.plan}` },
        }),
      })
      .addStep({
        id: 'verify',
        name: 'Verify Outcome',
        execute: () => ({
          success: true,
          patchContext: { verified: true },
        }),
      })

    const res = await workflow.run({ stepCount: 0 })

    expect(res.success).toBe(true)
    expect(res.completedSteps.length).toBe(3)
    expect(res.context.plan).toBe('Step 1: Code, Step 2: Test')
    expect(res.context.verified).toBe(true)
    expect(res.totalIterations).toBe(3)
  })

  it('bounds runaway infinite loops when a step keeps looping', async () => {
    const workflow = new BoundedWorkflow<DemoContext>()

    workflow.addStep({
      id: 'looping-step',
      name: 'Loop Forever',
      execute: (ctx) => ({
        success: true,
        nextStepId: 'looping-step', // self-loop
        patchContext: { stepCount: ctx.stepCount + 1 },
      }),
    })

    const res = await workflow.run({ stepCount: 0 }, { maxIterations: 5 })

    expect(res.success).toBe(false)
    expect(res.totalIterations).toBe(5)
    expect(res.error).toContain('Exceeded maximum allowed iterations')
    expect(res.context.stepCount).toBe(5)
  })

  it('stops and reports error when a step fails permanently', async () => {
    const workflow = new BoundedWorkflow<DemoContext>()

    workflow
      .addStep({
        id: 'failing-step',
        name: 'Flaky Step',
        execute: () => ({
          success: false,
          error: 'Database connection failed',
        }),
        maxRetries: 1,
      })
      .addStep({
        id: 'never-reached',
        name: 'Unreached Step',
        execute: () => ({ success: true }),
      })

    const res = await workflow.run({ stepCount: 0 })

    expect(res.success).toBe(false)
    expect(res.error).toContain("Step 'Flaky Step' failed after 2 attempts")
    expect(res.completedSteps.length).toBe(1)
    expect(res.completedSteps[0]?.attempts).toBe(2)
  })

  it('validates step configuration and rejects duplicate or invalid step definitions', () => {
    const workflow = new BoundedWorkflow<DemoContext>()

    expect(() => workflow.addStep(null as unknown as Parameters<typeof workflow.addStep>[0])).toThrow('Workflow step must be an object.')
    expect(() => workflow.addStep({ id: '', name: 'Test', execute: () => ({ success: true }) })).toThrow('Workflow step must have a non-empty string id.')
    expect(() => workflow.addStep({ id: 'test', name: '', execute: () => ({ success: true }) })).toThrow('Workflow step must have a non-empty string name.')
    expect(() => workflow.addStep({ id: 'test', name: 'Test', execute: null as unknown as () => { success: boolean } })).toThrow("Workflow step 'test' must provide an execute function.")

    workflow.addStep({ id: 'step-1', name: 'Step 1', execute: () => ({ success: true }) })
    expect(() => workflow.addStep({ id: 'step-1', name: 'Duplicate', execute: () => ({ success: true }) })).toThrow("already has a step with id 'step-1'")
  })

  it('interrupts slow steps with timeout instead of waiting indefinitely', async () => {
    const workflow = new BoundedWorkflow<DemoContext>()

    workflow.addStep({
      id: 'hanging-step',
      name: 'Hanging Step',
      timeoutMs: 50,
      execute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 500))
        return { success: true }
      },
    })

    const res = await workflow.run({ stepCount: 0 }, { timeoutMs: 200 })

    expect(res.success).toBe(false)
    expect(res.stopReason).toBe('timeout')
    expect(res.error).toContain("timed out after 50ms")
  })

  it('supports cancellation using AbortSignal', async () => {
    const workflow = new BoundedWorkflow<DemoContext>()
    const controller = new AbortController()

    workflow
      .addStep({
        id: 'step-1',
        name: 'Step 1',
        execute: () => {
          controller.abort()
          return { success: true, nextStepId: 'step-2' }
        },
      })
      .addStep({
        id: 'step-2',
        name: 'Step 2',
        execute: () => ({ success: true }),
      })

    const res = await workflow.run({ stepCount: 0 }, { signal: controller.signal })

    expect(res.success).toBe(false)
    expect(res.stopReason).toBe('cancelled')
    expect(res.completedSteps.length).toBe(1)
  })
})
