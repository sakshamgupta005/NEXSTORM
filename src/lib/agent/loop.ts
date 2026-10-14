/**
 * Bounded Agent Execution Loop
 * 
 * Capabilities:
 * - Dynamic Task -> Plan -> Tool Calling -> Observation loop
 * - Strict multi-level limits: max iterations, max tool calls, execution timeout, per-tool timeout
 * - Side-effect protection: prevents accidental retry of failed mutating actions (writes, payments, external calls)
 * - Strict cancellation support via AbortSignal
 * - Prompt secret sanitization (redacts sensitive tokens/keys)
 * - Clear, structured stop reasons (completed, max_iterations, max_tool_calls, timeout, cancelled, error)
 */

import { z } from 'zod'
import { ToolRegistry, type ToolExecutionResult } from './tools'
import { generateStructured } from '../ai/client'
import type { AIOptions } from '../ai/types'

export type AgentStopReason =
  | 'completed'
  | 'max_iterations'
  | 'max_tool_calls'
  | 'timeout'
  | 'cancelled'
  | 'error'

export const AgentActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('tool_call'),
    toolName: z.string().min(1, 'Tool name must not be empty'),
    arguments: z.record(z.string(), z.unknown()).default({}),
    thought: z.string().optional(),
  }),
  z.object({
    type: z.literal('final_answer'),
    answer: z.string(),
    thought: z.string().optional(),
  }),
])

export type AgentAction = z.infer<typeof AgentActionSchema>

export interface AgentIterationLog {
  iteration: number
  thought?: string
  action: AgentAction
  toolResult?: ToolExecutionResult
  durationMs: number
}

export interface AgentLoopResult {
  success: boolean
  stopReason: AgentStopReason
  finalAnswer?: string
  iterations: AgentIterationLog[]
  totalIterations: number
  totalToolCalls: number
  totalDurationMs: number
  error?: string
}

export type AgentModelCaller = (
  prompt: string,
  history: AgentIterationLog[],
  options?: { signal?: AbortSignal }
) => Promise<AgentAction>

export interface AgentLoopOptions {
  task: string
  context?: Record<string, unknown>
  tools: ToolRegistry
  /** Maximum number of reasoning / action iterations (default: 10, max: 30) */
  maxIterations?: number
  /** Maximum total number of tool calls permitted across the loop (default: 15, max: 50) */
  maxToolCalls?: number
  /** Overall loop execution timeout in milliseconds (default: 30,000ms) */
  timeoutMs?: number
  /** Per-tool execution timeout in milliseconds (default: 15,000ms) */
  toolTimeoutMs?: number
  /** AbortSignal for user or external cancellation */
  signal?: AbortSignal
  /**
   * If false (default), side-effecting tools (isReadOnly === false) that fail once
   * will not be permitted to execute again in subsequent iterations.
   */
  canRetrySideEffects?: boolean
  /** Pluggable model caller (useful for unit tests and custom models) */
  modelCaller?: AgentModelCaller
  /** Queue of mock actions to play sequentially (for testing) */
  mockActions?: AgentAction[]
  /** AI client options when using default LLM caller */
  aiOptions?: Partial<AIOptions>
}

const SENSITIVE_KEY_PATTERN = /(key|secret|token|password|auth|credential|cert|private|access)/i

/**
 * Strips secrets and sensitive key patterns from context objects before prompt construction.
 */
export function sanitizeContextForPrompt(ctx: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(ctx)) {
    if (SENSITIVE_KEY_PATTERN.test(k)) {
      sanitized[k] = '[REDACTED]'
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      sanitized[k] = sanitizeContextForPrompt(v as Record<string, unknown>)
    } else {
      sanitized[k] = v
    }
  }
  return sanitized
}

/**
 * Sanitizes plain string prompt content for common bearer token patterns.
 */
export function sanitizePromptText(text: string): string {
  return text.replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, 'Bearer [REDACTED]')
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

/**
 * Builds the prompt instructing the model on available tools and iteration history.
 */
function buildAgentPrompt(
  task: string,
  context: Record<string, unknown> | undefined,
  tools: ToolRegistry,
  history: AgentIterationLog[]
): string {
  const toolList = tools.getToolSummaries()
  const toolsFormatted = toolList
    .map(
      (t) =>
        `- ${t.name}: ${t.description} (side-effecting: ${!t.isReadOnly})`
    )
    .join('\n')

  let prompt = `Task: ${task}\n\n`

  if (context && Object.keys(context).length > 0) {
    const safeContext = sanitizeContextForPrompt(context)
    prompt += `Context: ${JSON.stringify(safeContext, null, 2)}\n\n`
  }

  prompt += `Available Tools:\n${toolsFormatted || 'No tools available.'}\n\n`

  if (history.length > 0) {
    prompt += `Execution History:\n`
    for (const item of history) {
      prompt += `Iteration ${item.iteration}:\n`
      if (item.thought) prompt += `  Thought: ${item.thought}\n`
      if (item.action.type === 'tool_call') {
        prompt += `  Action: Call tool '${item.action.toolName}' with arguments ${JSON.stringify(item.action.arguments)}\n`
        if (item.toolResult) {
          prompt += `  Result: ${item.toolResult.success ? 'SUCCESS' : 'FAILED'} - ${
            item.toolResult.error || JSON.stringify(item.toolResult.data)
          }\n`
        }
      }
      prompt += '\n'
    }
  }

  prompt += `Instructions:
Choose the next action. If you have enough information to fulfill the task, return a 'final_answer'.
Otherwise, return a 'tool_call' selecting one of the available tools.
Do NOT attempt to invent tools that are not listed.`

  return sanitizePromptText(prompt)
}

/**
 * Runs a bounded agent loop that iteratively consults a model and executes approved tools.
 */
export async function runAgentLoop(options: AgentLoopOptions): Promise<AgentLoopResult> {
  const startTime = Date.now()
  const rawMaxIterations = options.maxIterations ?? 10
  const maxIterations = Math.min(Math.max(1, rawMaxIterations), 30)

  const rawMaxToolCalls = options.maxToolCalls ?? 15
  const maxToolCalls = Math.min(Math.max(1, rawMaxToolCalls), 50)

  const timeoutMs = Math.max(10, options.timeoutMs ?? 30000)
  const defaultToolTimeout = Math.max(10, options.toolTimeoutMs ?? 15000)
  const signal = options.signal
  const canRetrySideEffects = options.canRetrySideEffects ?? false

  const history: AgentIterationLog[] = []
  let totalToolCalls = 0
  const failedSideEffectTools = new Set<string>()
  const mockQueue = options.mockActions ? [...options.mockActions] : null

  let iteration = 0

  while (iteration < maxIterations) {
    const iterationStart = Date.now()
    iteration++

    // 1. Cancellation Guard
    if (signal?.aborted) {
      return {
        success: false,
        stopReason: 'cancelled',
        iterations: history,
        totalIterations: iteration - 1,
        totalToolCalls,
        totalDurationMs: Date.now() - startTime,
        error: 'Agent loop was cancelled by signal.',
      }
    }

    // 2. Timeout Guard
    const elapsed = Date.now() - startTime
    const remainingTime = timeoutMs - elapsed
    if (remainingTime <= 0) {
      return {
        success: false,
        stopReason: 'timeout',
        iterations: history,
        totalIterations: iteration - 1,
        totalToolCalls,
        totalDurationMs: elapsed,
        error: `Agent loop timed out after ${timeoutMs}ms.`,
      }
    }

    // 3. Resolve Next Action from Model
    let action: AgentAction

    try {
      if (mockQueue && mockQueue.length > 0) {
        action = mockQueue.shift()!
      } else if (options.modelCaller) {
        const prompt = buildAgentPrompt(options.task, options.context, options.tools, history)
        const callerPromise = options.modelCaller(prompt, history, { signal })
        action = await raceWithTimeout(
          callerPromise,
          remainingTime,
          `Model call timed out after ${remainingTime}ms.`
        )
      } else {
        const prompt = buildAgentPrompt(options.task, options.context, options.tools, history)
        const result = await generateStructured<AgentAction>({
          prompt,
          schema: AgentActionSchema,
          provider: options.aiOptions?.provider ?? 'mock',
          model: options.aiOptions?.model,
          apiKey: options.aiOptions?.apiKey,
          mockResponse: {
            type: 'final_answer',
            answer: 'Mock response completed successfully.',
          },
        })

        if (!result.success || !result.data) {
          throw new Error(result.error || 'Failed to generate model action.')
        }
        action = result.data
      }
    } catch (err) {
      const isTimeout = err instanceof Error && err.message.includes('timed out')
      const isCancelled = signal?.aborted || (err instanceof Error && err.message.includes('cancelled'))
      const stopReason: AgentStopReason = isCancelled ? 'cancelled' : isTimeout ? 'timeout' : 'error'

      return {
        success: false,
        stopReason,
        iterations: history,
        totalIterations: iteration - 1,
        totalToolCalls,
        totalDurationMs: Date.now() - startTime,
        error: `Model step failed: ${err instanceof Error ? err.message : String(err)}`,
      }
    }

    // 4. Handle Final Answer
    if (action.type === 'final_answer') {
      history.push({
        iteration,
        thought: action.thought,
        action,
        durationMs: Date.now() - iterationStart,
      })

      return {
        success: true,
        stopReason: 'completed',
        finalAnswer: action.answer,
        iterations: history,
        totalIterations: iteration,
        totalToolCalls,
        totalDurationMs: Date.now() - startTime,
      }
    }

    // 5. Handle Tool Call
    if (action.type === 'tool_call') {
      // Check tool call budget
      if (totalToolCalls >= maxToolCalls) {
        return {
          success: false,
          stopReason: 'max_tool_calls',
          iterations: history,
          totalIterations: iteration,
          totalToolCalls,
          totalDurationMs: Date.now() - startTime,
          error: `Exceeded maximum allowed tool calls (${maxToolCalls}).`,
        }
      }

      totalToolCalls++
      const targetTool = options.tools.getTool(action.toolName)
      let toolResult: ToolExecutionResult

      // Check side-effect protection
      if (targetTool && targetTool.isReadOnly === false && failedSideEffectTools.has(action.toolName) && !canRetrySideEffects) {
        toolResult = {
          success: false,
          toolName: action.toolName,
          error: `Automatic retry of side-effecting tool '${action.toolName}' is disabled to prevent duplicate writes or actions.`,
          errorCode: 'EXECUTION_ERROR',
          durationMs: 0,
          isReadOnly: false,
        }
      } else {
        const currentElapsed = Date.now() - startTime
        const toolBudget = Math.min(defaultToolTimeout, Math.max(10, timeoutMs - currentElapsed))

        toolResult = await options.tools.execute(action.toolName, action.arguments, {
          signal,
          timeoutMs: toolBudget,
        })

        // Track failed side effects
        if (!toolResult.success && !toolResult.isReadOnly) {
          failedSideEffectTools.add(action.toolName)
        }
      }

      history.push({
        iteration,
        thought: action.thought,
        action,
        toolResult,
        durationMs: Date.now() - iterationStart,
      })

      // If tool execution was cancelled or timed out due to overall loop constraints
      if (toolResult.errorCode === 'CANCELLED' || signal?.aborted) {
        return {
          success: false,
          stopReason: 'cancelled',
          iterations: history,
          totalIterations: iteration,
          totalToolCalls,
          totalDurationMs: Date.now() - startTime,
          error: 'Execution cancelled during tool call.',
        }
      }
    }
  }

  // Loop bounded by maximum iterations
  return {
    success: false,
    stopReason: 'max_iterations',
    iterations: history,
    totalIterations: iteration,
    totalToolCalls,
    totalDurationMs: Date.now() - startTime,
    error: `Exceeded maximum allowed iterations (${maxIterations}). Loop bounded safely.`,
  }
}
