import { describe, it, expect } from 'vitest'
import {
  createStructuredPlan,
  validatePlanDependencies,
  getExecutableTasks,
  type StructuredPlan,
} from '@/lib/agent/planner'
import {
  QualityGateSuite,
  createQualityGate,
} from '@/lib/agent/quality-gates'
import { runOrchestration } from '@/lib/agent/orchestrator'

describe('Structured Task Planning', () => {
  it('validates plan dependencies and detects invalid or missing references', () => {
    const invalidPlan: StructuredPlan = {
      objective: 'Build Feature',
      acceptanceCriteria: ['Feature works'],
      tasks: [
        {
          id: 'task-1',
          title: 'Implement',
          description: 'Code it',
          dependencies: ['non-existent-task'],
          verificationSteps: [],
          isDestructive: false,
        },
      ],
      risks: [],
      assumptions: [],
    }

    const res = validatePlanDependencies(invalidPlan)
    expect(res.valid).toBe(false)
    expect(res.errors[0]).toContain("references non-existent dependency 'non-existent-task'")
  })

  it('detects circular dependencies in plans', () => {
    const cyclePlan: StructuredPlan = {
      objective: 'Cycle Test',
      acceptanceCriteria: ['Pass'],
      tasks: [
        {
          id: 'task-a',
          title: 'Task A',
          description: 'A',
          dependencies: ['task-b'],
          verificationSteps: [],
          isDestructive: false,
        },
        {
          id: 'task-b',
          title: 'Task B',
          description: 'B',
          dependencies: ['task-a'],
          verificationSteps: [],
          isDestructive: false,
        },
      ],
      risks: [],
      assumptions: [],
    }

    const res = validatePlanDependencies(cyclePlan)
    expect(res.valid).toBe(false)
    expect(res.errors[0]).toContain('Circular dependency detected')
  })

  it('correctly resolves executable tasks topologically based on satisfied dependencies', () => {
    const plan: StructuredPlan = {
      objective: 'Multi-step Pipeline',
      acceptanceCriteria: ['Done'],
      tasks: [
        {
          id: 'step-1',
          title: 'Step 1',
          description: 'Foundation',
          dependencies: [],
          verificationSteps: [],
          isDestructive: false,
        },
        {
          id: 'step-2',
          title: 'Step 2',
          description: 'Depends on 1',
          dependencies: ['step-1'],
          verificationSteps: [],
          isDestructive: false,
        },
      ],
      risks: [],
      assumptions: [],
    }

    // Initially, only step-1 is executable
    const executable1 = getExecutableTasks(plan, new Set())
    expect(executable1.map((t) => t.id)).toEqual(['step-1'])

    // Once step-1 is completed, step-2 becomes executable
    const executable2 = getExecutableTasks(plan, new Set(['step-1']))
    expect(executable2.map((t) => t.id)).toEqual(['step-2'])
  })

  it('creates valid plan from mock input', async () => {
    const plan = await createStructuredPlan({
      task: 'Add logging',
      mockPlan: {
        objective: 'Add structured logging',
        acceptanceCriteria: ['Logs include timestamp'],
        tasks: [
          {
            id: 't-1',
            title: 'Create logger',
            description: 'Implement logger.ts',
            dependencies: [],
            verificationSteps: ['Run unit test'],
            isDestructive: false,
          },
        ],
        risks: [],
        assumptions: [],
      },
    })

    expect(plan.objective).toBe('Add structured logging')
    expect(plan.tasks.length).toBe(1)
  })
})

describe('Quality Gates', () => {
  it('enforces required vs. optional gates and prevents false success', async () => {
    const suite = new QualityGateSuite()

    suite.addGate(createQualityGate('typecheck', 'Type Check', 'typecheck', true, () => true))
    suite.addGate(createQualityGate('lint', 'Linter', 'lint', true, () => false)) // Required gate fails
    suite.addGate(createQualityGate('audit', 'Security Audit', 'custom', false, () => false)) // Optional fails

    const res = await suite.runAll()
    expect(res.allPassed).toBe(false)
    expect(res.requiredPassed).toBe(false) // Required failed because lint failed
    expect(res.failedGates.length).toBe(2)
  })

  it('passes when all required gates succeed even if optional gate fails', async () => {
    const suite = new QualityGateSuite()

    suite.addGate(createQualityGate('typecheck', 'Type Check', 'typecheck', true, () => true))
    suite.addGate(createQualityGate('perf', 'Performance Benchmark', 'custom', false, () => false))

    const res = await suite.runAll()
    expect(res.allPassed).toBe(false)
    expect(res.requiredPassed).toBe(true) // Required passed!
  })
})

describe('Autonomous Orchestrator & Bounded Improvement Loop', () => {
  it('completes plan successfully across ordered tasks', async () => {
    const executionOrder: string[] = []

    const plan: StructuredPlan = {
      objective: 'Build Feature Flow',
      acceptanceCriteria: ['Feature built and verified'],
      tasks: [
        {
          id: 'task-1',
          title: 'Database Schema',
          description: 'Set up tables',
          dependencies: [],
          verificationSteps: [],
          isDestructive: false,
        },
        {
          id: 'task-2',
          title: 'API Route',
          description: 'Create endpoint',
          dependencies: ['task-1'],
          verificationSteps: [],
          isDestructive: false,
        },
      ],
      risks: [],
      assumptions: [],
    }

    const report = await runOrchestration({
      task: 'Build Feature Flow',
      plan,
      taskExecutor: async (task) => {
        executionOrder.push(task.id)
        return { success: true, filesChanged: [`${task.id}.ts`] }
      },
    })

    expect(report.success).toBe(true)
    expect(report.stopReason).toBe('criteria_satisfied')
    expect(executionOrder).toEqual(['task-1', 'task-2'])
    expect(report.completedCriteria).toEqual(['Feature built and verified'])
    expect(report.filesOrCapabilitiesChanged).toEqual(['task-1.ts', 'task-2.ts'])
  })

  it('triggers evidence-based correction when quality gates fail, then succeeds', async () => {
    let gateAttempts = 0
    let receivedCorrectionError: string | undefined

    const gates = new QualityGateSuite()
    gates.addGate(
      createQualityGate('unit-tests', 'Unit Tests', 'test', true, () => {
        gateAttempts++
        return gateAttempts > 1 // Fails first time, passes after correction!
      })
    )

    const plan: StructuredPlan = {
      objective: 'Fix Bug',
      acceptanceCriteria: ['Bug fixed'],
      tasks: [
        {
          id: 'fix-task',
          title: 'Apply bugfix',
          description: 'Fix the null pointer',
          dependencies: [],
          verificationSteps: [],
          isDestructive: false,
        },
      ],
      risks: [],
      assumptions: [],
    }

    const report = await runOrchestration({
      task: 'Fix Bug',
      plan,
      qualityGates: gates,
      maxCorrections: 2,
      taskExecutor: async (_task, ctx) => {
        if (ctx.correctionError) {
          receivedCorrectionError = ctx.correctionError
        }
        return { success: true }
      },
    })

    expect(report.success).toBe(true)
    expect(report.stopReason).toBe('criteria_satisfied')
    expect(report.correctionsAttempted).toBe(1)
    expect(receivedCorrectionError).toContain("Gate 'Unit Tests' failed")
  })

  it('halts when correction limit is exhausted without infinite loops', async () => {
    const gates = new QualityGateSuite()
    // Permanently failing gate
    gates.addGate(
      createQualityGate('strict-check', 'Strict Check', 'test', true, () => false)
    )

    const plan: StructuredPlan = {
      objective: 'Strict Task',
      acceptanceCriteria: ['Strict'],
      tasks: [
        {
          id: 'task-1',
          title: 'Implement',
          description: 'Do work',
          dependencies: [],
          verificationSteps: [],
          isDestructive: false,
        },
      ],
      risks: [],
      assumptions: [],
    }

    const report = await runOrchestration({
      task: 'Strict Task',
      plan,
      qualityGates: gates,
      maxCorrections: 2,
      taskExecutor: async () => ({ success: true }),
    })

    expect(report.success).toBe(false)
    expect(report.stopReason).toBe('max_corrections')
    expect(report.correctionsAttempted).toBe(2)
    expect(report.remainingBlockers.length).toBeGreaterThan(0)
  })

  it('requires human approval for destructive tasks and stops when denied', async () => {
    let approvalRequested = false

    const plan: StructuredPlan = {
      objective: 'Purge Old Data',
      acceptanceCriteria: ['Data cleaned up'],
      tasks: [
        {
          id: 'purge-task',
          title: 'Drop Old Tables',
          description: 'DROP TABLE legacy_users',
          dependencies: [],
          verificationSteps: [],
          isDestructive: true, // Destructive action!
        },
      ],
      risks: ['Data loss'],
      assumptions: [],
    }

    const report = await runOrchestration({
      task: 'Purge Old Data',
      plan,
      requestApproval: (req) => {
        approvalRequested = true
        expect(req.isDestructive).toBe(true)
        return false // Denied!
      },
      taskExecutor: async () => ({ success: true }),
    })

    expect(approvalRequested).toBe(true)
    expect(report.success).toBe(false)
    expect(report.stopReason).toBe('approval_denied')
    expect(report.remainingBlockers[0]).toContain('was denied approval')
  })

  it('halts safely on AbortSignal cancellation', async () => {
    const controller = new AbortController()
    controller.abort()

    const plan: StructuredPlan = {
      objective: 'Cancel Test',
      acceptanceCriteria: ['Pass'],
      tasks: [
        {
          id: 'task-1',
          title: 'Step',
          description: 'Step',
          dependencies: [],
          verificationSteps: [],
          isDestructive: false,
        },
      ],
      risks: [],
      assumptions: [],
    }

    const report = await runOrchestration({
      task: 'Cancel Test',
      plan,
      signal: controller.signal,
      taskExecutor: async () => ({ success: true }),
    })

    expect(report.success).toBe(false)
    expect(report.stopReason).toBe('cancelled')
  })

  it('halts safely when timeout is reached', async () => {
    const plan: StructuredPlan = {
      objective: 'Slow Test',
      acceptanceCriteria: ['Pass'],
      tasks: [
        {
          id: 'slow-task',
          title: 'Slow Step',
          description: 'Takes a while',
          dependencies: [],
          verificationSteps: [],
          isDestructive: false,
        },
      ],
      risks: [],
      assumptions: [],
    }

    const report = await runOrchestration({
      task: 'Slow Test',
      plan,
      timeoutMs: 30,
      taskExecutor: async () => {
        await new Promise((r) => setTimeout(r, 100))
        return { success: true }
      },
    })

    expect(report.success).toBe(false)
    expect(report.stopReason).toBe('timeout')
  })
})
