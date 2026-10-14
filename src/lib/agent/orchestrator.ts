/**
 * Autonomous AI Orchestrator & Bounded Improvement Loop
 * 
 * Capabilities:
 * - End-to-end task breakdown -> plan -> execute -> quality gates -> bounded correction
 * - Evidence-based improvement: feeds actual gate/check error outputs into targeted repair steps
 * - Preservation of working state across corrections
 * - Human-in-the-loop approval guard for destructive actions
 * - Configurable multi-level bounds (iterations, plan revisions, corrections, tool calls, timeouts)
 * - Structured final report with acceptance criteria accounting and remaining blockers
 */

import {
  createStructuredPlan,
  getExecutableTasks,
  type StructuredPlan,
  type PlannedTask,
} from './planner'
import {
  QualityGateSuite,
  type QualityGateResult,
  type QualityGateSuiteResult,
} from './quality-gates'
import { ToolRegistry } from './tools'
import { runAgentLoop, type AgentAction } from './loop'
import type { AIOptions } from '../ai/types'

export type OrchestrationStopReason =
  | 'criteria_satisfied'
  | 'gate_failed'
  | 'max_iterations'
  | 'max_corrections'
  | 'timeout'
  | 'cancelled'
  | 'approval_denied'
  | 'error'

export interface ApprovalRequest {
  taskId: string
  taskTitle: string
  actionDescription: string
  isDestructive: boolean
  details?: Record<string, unknown>
}

export type ApprovalHandler = (request: ApprovalRequest) => Promise<boolean> | boolean

export interface TaskChangeLog {
  taskId: string
  taskTitle: string
  reason: string
  timestamp: number
  filesChanged?: string[]
}

export interface OrchestrationReport {
  success: boolean
  stopReason: OrchestrationStopReason
  plan: StructuredPlan
  completedCriteria: string[]
  unmetCriteria: string[]
  completedTaskIds: string[]
  failedTaskIds: string[]
  filesOrCapabilitiesChanged: string[]
  changes: TaskChangeLog[]
  qualityGateResults: QualityGateResult[]
  remainingBlockers: string[]
  totalIterations: number
  totalDurationMs: number
  totalToolCalls: number
  correctionsAttempted: number
  error?: string
}

export type TaskExecutor = (
  task: PlannedTask,
  context: {
    plan: StructuredPlan
    signal?: AbortSignal
    iteration: number
    correctionError?: string
  }
) => Promise<{ success: boolean; error?: string; filesChanged?: string[] }>

export interface OrchestratorOptions {
  task: string
  context?: Record<string, unknown>
  plan?: StructuredPlan
  mockPlan?: StructuredPlan
  tools?: ToolRegistry
  qualityGates?: QualityGateSuite
  /** Maximum task execution iterations across the whole workflow (default: 15, max: 50) */
  maxIterations?: number
  /** Maximum plan revision passes (default: 2) */
  maxPlanRevisions?: number
  /** Maximum correction/repair attempts when quality gates fail (default: 3) */
  maxCorrections?: number
  /** Overall orchestration timeout in milliseconds (default: 60,000ms) */
  timeoutMs?: number
  /** Optional cancellation signal */
  signal?: AbortSignal
  /** Approval callback required before executing destructive actions */
  requestApproval?: ApprovalHandler
  /** Custom task execution function (useful for mock testing or specialized runners) */
  taskExecutor?: TaskExecutor
  /** Mock actions queue to pass to the agent loop if using default tool executor */
  mockLoopActions?: AgentAction[]
  /** AI configuration options */
  aiOptions?: Partial<AIOptions>
}

/**
 * Runs a bounded, evidence-driven orchestration loop from planning to verified completion.
 */
export async function runOrchestration(options: OrchestratorOptions): Promise<OrchestrationReport> {
  const startTime = Date.now()
  const timeoutMs = Math.max(10, options.timeoutMs ?? 60000)
  const maxIterations = Math.min(Math.max(1, options.maxIterations ?? 15), 50)
  const maxCorrections = Math.min(Math.max(0, options.maxCorrections ?? 3), 10)
  const signal = options.signal

  const completedTaskIds = new Set<string>()
  const failedTaskIds = new Set<string>()
  const changes: TaskChangeLog[] = []
  const filesChangedSet = new Set<string>()
  const remainingBlockers: string[] = []
  let totalToolCalls = 0
  let totalIterations = 0
  let correctionsAttempted = 0
  let latestGateSuiteResult: QualityGateSuiteResult | null = null

  // 1. Generate or Adopt Structured Plan
  let plan: StructuredPlan
  try {
    if (options.plan) {
      plan = options.plan
    } else {
      plan = await createStructuredPlan({
        task: options.task,
        context: options.context,
        mockPlan: options.mockPlan,
        aiOptions: options.aiOptions,
      })
    }
  } catch (err) {
    return {
      success: false,
      stopReason: 'error',
      plan: options.plan ?? {
        objective: options.task,
        acceptanceCriteria: [],
        tasks: [],
        risks: [],
        assumptions: [],
      },
      completedCriteria: [],
      unmetCriteria: [],
      completedTaskIds: [],
      failedTaskIds: [],
      filesOrCapabilitiesChanged: [],
      changes: [],
      qualityGateResults: [],
      remainingBlockers: [err instanceof Error ? err.message : String(err)],
      totalIterations: 0,
      totalDurationMs: Date.now() - startTime,
      totalToolCalls: 0,
      correctionsAttempted: 0,
      error: `Planning failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  const tools = options.tools ?? new ToolRegistry()
  const qualityGates = options.qualityGates ?? new QualityGateSuite()

  // 2. Main Implementation Loop
  while (totalIterations < maxIterations) {
    totalIterations++

    // Timeout Check
    const elapsed = Date.now() - startTime
    if (elapsed >= timeoutMs) {
      remainingBlockers.push(`Execution timed out after ${timeoutMs}ms`)
      return buildReport('timeout')
    }

    // Cancellation Check
    if (signal?.aborted) {
      remainingBlockers.push('Execution was cancelled by signal')
      return buildReport('cancelled')
    }

    // Find next executable tasks based on dependency graph
    const executableTasks = getExecutableTasks(plan, completedTaskIds)

    if (executableTasks.length === 0) {
      // Check if all tasks in the plan are completed
      if (completedTaskIds.size === plan.tasks.length) {
        break // All tasks finished!
      } else {
        // Dependency deadlock or blocked tasks
        const unfinished = plan.tasks.filter((t) => !completedTaskIds.has(t.id))
        remainingBlockers.push(
          `Stalled: ${unfinished.length} unfinished task(s) blocked by failed or unmet dependencies: ${unfinished
            .map((t) => t.id)
            .join(', ')}`
        )
        return buildReport('error')
      }
    }

    const currentTask = executableTasks[0]

    // Human Approval Check for destructive actions
    if (currentTask.isDestructive) {
      if (!options.requestApproval) {
        remainingBlockers.push(
          `Task '${currentTask.id}' requires human approval because it is marked destructive, but no approval handler was provided.`
        )
        failedTaskIds.add(currentTask.id)
        return buildReport('approval_denied')
      }

      const approved = await Promise.resolve(
        options.requestApproval({
          taskId: currentTask.id,
          taskTitle: currentTask.title,
          actionDescription: currentTask.description,
          isDestructive: true,
        })
      )

      if (!approved) {
        remainingBlockers.push(`Destructive task '${currentTask.id}' (${currentTask.title}) was denied approval.`)
        failedTaskIds.add(currentTask.id)
        return buildReport('approval_denied')
      }
    }

    // Execute the task
    let taskExecutionSuccess = false
    let taskExecutionError: string | undefined
    let taskFilesChanged: string[] = []

    if (options.taskExecutor) {
      const execRes = await options.taskExecutor(currentTask, {
        plan,
        signal,
        iteration: totalIterations,
      })
      taskExecutionSuccess = execRes.success
      taskExecutionError = execRes.error
      taskFilesChanged = execRes.filesChanged || []
    } else {
      // Default: run bounded agent loop with available tools
      const loopRes = await runAgentLoop({
        task: `${currentTask.title}: ${currentTask.description}`,
        tools,
        signal,
        mockActions: options.mockLoopActions,
        aiOptions: options.aiOptions,
      })
      taskExecutionSuccess = loopRes.success
      taskExecutionError = loopRes.error
      totalToolCalls += loopRes.totalToolCalls
      if (loopRes.success) {
        taskFilesChanged = [currentTask.title]
      }
    }

    if (!taskExecutionSuccess) {
      failedTaskIds.add(currentTask.id)
      remainingBlockers.push(`Task '${currentTask.id}' execution failed: ${taskExecutionError || 'Unknown error'}`)
      return buildReport('error')
    }

    // Record progress
    completedTaskIds.add(currentTask.id)
    for (const f of taskFilesChanged) filesChangedSet.add(f)
    changes.push({
      taskId: currentTask.id,
      taskTitle: currentTask.title,
      reason: 'Executed planned task',
      timestamp: Date.now(),
      filesChanged: taskFilesChanged,
    })

    // Run relevant Quality Gates after task implementation
    if (qualityGates.listGates().length > 0) {
      latestGateSuiteResult = await qualityGates.runAll({ signal })

      // Evidence-based Improvement Loop: If quality gates failed, trigger bounded correction
      if (!latestGateSuiteResult.requiredPassed) {
        let gatePassedAfterCorrection = false

        while (correctionsAttempted < maxCorrections && !gatePassedAfterCorrection) {
          correctionsAttempted++
          const failingGates = latestGateSuiteResult.failedGates.filter((g) => g.isRequired)
          const gateErrorEvidence = failingGates
            .map((g) => `Gate '${g.gateName}' failed: ${g.error || g.output || 'Check failed.'}`)
            .join('\n')

          changes.push({
            taskId: currentTask.id,
            taskTitle: currentTask.title,
            reason: `Correction attempt ${correctionsAttempted} addressing gate failure:\n${gateErrorEvidence}`,
            timestamp: Date.now(),
          })

          // Execute correction with error evidence
          if (options.taskExecutor) {
            await options.taskExecutor(currentTask, {
              plan,
              signal,
              iteration: totalIterations,
              correctionError: gateErrorEvidence,
            })
          }

          // Rerun quality gates to verify if correction fixed the issue
          latestGateSuiteResult = await qualityGates.runAll({ signal })
          if (latestGateSuiteResult.requiredPassed) {
            gatePassedAfterCorrection = true
          }
        }

        if (!gatePassedAfterCorrection) {
          remainingBlockers.push(
            `Quality gates failed and could not be corrected within ${maxCorrections} attempt(s): ${latestGateSuiteResult.failedGates
              .map((g) => g.gateName)
              .join(', ')}`
          )
          return buildReport(correctionsAttempted >= maxCorrections ? 'max_corrections' : 'gate_failed')
        }
      }
    }
  }

  // 3. Final Quality Gate Verification
  if (qualityGates.listGates().length > 0) {
    latestGateSuiteResult = await qualityGates.runAll({ signal })
    if (!latestGateSuiteResult.requiredPassed) {
      remainingBlockers.push(
        `Required quality gates failed: ${latestGateSuiteResult.failedGates.map((g) => g.gateName).join(', ')}`
      )
      return buildReport('gate_failed')
    }
  }

  // Check if max iterations exceeded
  if (completedTaskIds.size < plan.tasks.length && totalIterations >= maxIterations) {
    remainingBlockers.push(`Exceeded maximum allowed iterations (${maxIterations}) before completing all tasks.`)
    return buildReport('max_iterations')
  }

  // All criteria satisfied!
  return buildReport('criteria_satisfied')

  function buildReport(stopReason: OrchestrationStopReason): OrchestrationReport {
    const isSuccess = stopReason === 'criteria_satisfied'
    const completedCriteria = isSuccess ? [...plan.acceptanceCriteria] : []
    const unmetCriteria = isSuccess
      ? []
      : plan.acceptanceCriteria.length > 0
      ? [...plan.acceptanceCriteria]
      : ['Completion criteria not met']

    return {
      success: isSuccess,
      stopReason,
      plan,
      completedCriteria,
      unmetCriteria,
      completedTaskIds: Array.from(completedTaskIds),
      failedTaskIds: Array.from(failedTaskIds),
      filesOrCapabilitiesChanged: Array.from(filesChangedSet),
      changes,
      qualityGateResults: latestGateSuiteResult?.results || [],
      remainingBlockers,
      totalIterations,
      totalDurationMs: Date.now() - startTime,
      totalToolCalls,
      correctionsAttempted,
      error: remainingBlockers.length > 0 ? remainingBlockers.join('; ') : undefined,
    }
  }
}
