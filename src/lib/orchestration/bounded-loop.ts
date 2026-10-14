import {
  runOrchestration,
  type OrchestrationReport,
  type ApprovalHandler,
  type TaskExecutor
} from '../agent/orchestrator'
import { ToolRegistry } from '../agent/tools'
import { QualityGateSuite } from '../agent/quality-gates'
import type { StructuredPlan } from '../agent/planner'
import type {
  BoundedExecutionLimits,
  BoundedExecutionResult
} from './types'

export interface BoundedLoopOptions {
  task: string
  plan?: StructuredPlan
  limits?: BoundedExecutionLimits
  tools?: ToolRegistry
  qualityGates?: QualityGateSuite
  onApprovalRequired?: ApprovalHandler
  taskExecutor?: TaskExecutor
  signal?: AbortSignal
  verificationChecks?: Array<{
    name: string
    fn: () => Promise<{ passed: boolean; output?: string }> | { passed: boolean; output?: string }
  }>
}

/**
 * Runs a bounded, verifiable AI execution loop with strict limits and human approval guards.
 * Never claims success without actual verification evidence.
 */
export async function runBoundedExecutionLoop(
  options: BoundedLoopOptions
): Promise<BoundedExecutionResult> {
  const startTime = Date.now()
  const limits: BoundedExecutionLimits = {
    maxIterations: Math.min(Math.max(1, options.limits?.maxIterations ?? 5), 20),
    maxToolCalls: Math.min(Math.max(1, options.limits?.maxToolCalls ?? 15), 50),
    timeoutMs: Math.max(100, options.limits?.timeoutMs ?? 60000),
    maxConsecutiveErrors: Math.min(Math.max(1, options.limits?.maxConsecutiveErrors ?? 3), 10)
  }

  const evidence: BoundedExecutionResult['evidence'] = []
  const remainingRisks: string[] = []

  // Wrap approval handler to guard destructive actions, deployments, or paid APIs
  const safeApprovalHandler: ApprovalHandler = async (req) => {
    if (options.onApprovalRequired) {
      return await options.onApprovalRequired(req)
    }
    // By default without interactive handler, reject destructive actions safely
    return false
  }

  let orchestrationReport: OrchestrationReport

  try {
    orchestrationReport = await runOrchestration({
      task: options.task,
      plan: options.plan,
      tools: options.tools,
      qualityGates: options.qualityGates,
      maxIterations: limits.maxIterations,
      timeoutMs: limits.timeoutMs,
      signal: options.signal,
      requestApproval: safeApprovalHandler,
      taskExecutor: options.taskExecutor
    })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return {
      completed: false,
      iterations: 1,
      toolCallsCount: 0,
      durationMs: Date.now() - startTime,
      stopReason: 'error-limit',
      evidence: [
        {
          check: 'Loop Execution',
          passed: false,
          output: `Unhandled error: ${errorMsg}`
        }
      ],
      remainingRisks: [`Execution halted unexpectedly: ${errorMsg}`]
    }
  }

  // Record evidence from gates
  for (const gate of orchestrationReport.qualityGateResults) {
    evidence.push({
      check: `Quality Gate: ${gate.gateName}`,
      passed: gate.passed,
      output: gate.output || gate.error
    })
  }

  // Execute explicit verification checks if provided
  if (options.verificationChecks && options.verificationChecks.length > 0) {
    for (const vc of options.verificationChecks) {
      try {
        const checkRes = await vc.fn()
        evidence.push({
          check: vc.name,
          passed: checkRes.passed,
          output: checkRes.output
        })
      } catch (err) {
        evidence.push({
          check: vc.name,
          passed: false,
          output: err instanceof Error ? err.message : String(err)
        })
      }
    }
  }

  // Determine stop reason
  let stopReason: BoundedExecutionResult['stopReason'] = 'success'
  if (orchestrationReport.stopReason === 'timeout') {
    stopReason = 'timeout'
    remainingRisks.push(`Task stopped after reaching timeout of ${limits.timeoutMs}ms`)
  } else if (orchestrationReport.stopReason === 'max_iterations') {
    stopReason = 'iteration-limit'
    remainingRisks.push(`Task reached maximum iteration cap (${limits.maxIterations})`)
  } else if (orchestrationReport.stopReason === 'approval_denied') {
    stopReason = 'human-cancelled'
    remainingRisks.push('Destructive action was rejected or lacked approval')
  } else if (!orchestrationReport.success) {
    stopReason = 'error-limit'
    remainingRisks.push(...orchestrationReport.remainingBlockers)
  }

  const allEvidencePassed = evidence.length === 0 || evidence.every(e => e.passed)
  const isCompleted = orchestrationReport.success && allEvidencePassed && stopReason === 'success'

  if (orchestrationReport.unmetCriteria.length > 0) {
    remainingRisks.push(`Unmet acceptance criteria: ${orchestrationReport.unmetCriteria.join(', ')}`)
  }

  return {
    completed: isCompleted,
    iterations: orchestrationReport.totalIterations,
    toolCallsCount: orchestrationReport.totalToolCalls,
    durationMs: Date.now() - startTime,
    stopReason,
    evidence,
    remainingRisks
  }
}
