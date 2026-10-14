/**
 * Generic Agent Tool Registry & Execution Harness
 * 
 * Capabilities:
 * - Explicit tool registration with Zod argument validation
 * - Execution timeout and AbortSignal cancellation
 * - Side-effect annotation (isReadOnly) to prevent accidental retries
 * - Normalized tool execution results (never crashes the agent loop)
 * - Safe schema export for LLM prompt generation
 */

import { z } from 'zod'
import type { VerificationResult } from './checkpoint'

export interface ToolExecutionContext {
  signal?: AbortSignal
}

export interface AgentTool<TInput = unknown, TOutput = unknown> {
  name: string
  description: string
  parameters: z.ZodType<TInput>
  execute: (args: TInput, context?: ToolExecutionContext) => Promise<TOutput> | TOutput
  /** Optional verification function run after tool execution to confirm effect */
  verify?: (
    result: TOutput,
    args: TInput,
    context?: ToolExecutionContext
  ) => Promise<VerificationResult | boolean> | VerificationResult | boolean
  /** Whether the tool is read-only (false = mutating side-effect like write/payment/email) */
  isReadOnly?: boolean
  /** Optional per-tool execution timeout in milliseconds */
  timeoutMs?: number
  /** Optional max verification retries (default: 1, max: 5) */
  maxVerificationRetries?: number
}

export interface ToolExecutionResult<T = unknown> {
  success: boolean
  toolName: string
  data?: T
  error?: string
  errorCode?:
    | 'TOOL_NOT_FOUND'
    | 'INVALID_ARGUMENTS'
    | 'TIMEOUT'
    | 'CANCELLED'
    | 'EXECUTION_ERROR'
    | 'VERIFICATION_FAILED'
  durationMs: number
  isReadOnly: boolean
  verification?: VerificationResult
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

export type AnyAgentTool = AgentTool<unknown, unknown>

export class ToolRegistry {
  private tools = new Map<string, AnyAgentTool>()

  register<TInput, TOutput>(tool: AgentTool<TInput, TOutput>): this {
    if (!tool || typeof tool !== 'object') {
      throw new Error('Tool must be an object.')
    }
    if (!tool.name || typeof tool.name !== 'string' || tool.name.trim() === '') {
      throw new Error('Tool must have a non-empty string name.')
    }
    if (!tool.description || typeof tool.description !== 'string') {
      throw new Error(`Tool '${tool.name}' must have a description.`)
    }
    if (!tool.parameters || typeof tool.parameters.safeParse !== 'function') {
      throw new Error(`Tool '${tool.name}' must provide a valid Zod schema in parameters.`)
    }
    if (typeof tool.execute !== 'function') {
      throw new Error(`Tool '${tool.name}' must provide an execute function.`)
    }
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered. Names must be unique.`)
    }

    this.tools.set(tool.name, tool as unknown as AnyAgentTool)
    return this
  }

  getTool(name: string): AnyAgentTool | undefined {
    return this.tools.get(name)
  }

  hasTool(name: string): boolean {
    return this.tools.has(name)
  }

  listTools(): AnyAgentTool[] {
    return Array.from(this.tools.values())
  }

  /**
   * Returns a lightweight summary of available tools for AI prompting.
   */
  getToolSummaries(): Array<{ name: string; description: string; isReadOnly: boolean }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      isReadOnly: t.isReadOnly ?? true,
    }))
  }

  async execute(
    name: string,
    rawArgs: unknown,
    options: { signal?: AbortSignal; timeoutMs?: number } = {}
  ): Promise<ToolExecutionResult> {
    const start = Date.now()
    const tool = this.tools.get(name)

    // 1. Tool existence check
    if (!tool) {
      return {
        success: false,
        toolName: name,
        error: `Tool '${name}' is not registered or approved.`,
        errorCode: 'TOOL_NOT_FOUND',
        durationMs: Date.now() - start,
        isReadOnly: true,
      }
    }

    const isReadOnly = tool.isReadOnly ?? true

    // 2. Cancellation check
    if (options.signal?.aborted) {
      return {
        success: false,
        toolName: name,
        error: 'Tool execution was cancelled before start.',
        errorCode: 'CANCELLED',
        durationMs: Date.now() - start,
        isReadOnly,
      }
    }

    // 3. Schema validation
    const parsedArgs = tool.parameters.safeParse(rawArgs)
    if (!parsedArgs.success) {
      const issueDetails = parsedArgs.error.issues
        .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
        .join(', ')
      return {
        success: false,
        toolName: name,
        error: `Invalid tool arguments for '${name}': ${issueDetails}`,
        errorCode: 'INVALID_ARGUMENTS',
        durationMs: Date.now() - start,
        isReadOnly,
      }
    }

    // 4. Execution with timeout & cancellation
    const effectiveTimeout = options.timeoutMs ?? tool.timeoutMs ?? 15000

    try {
      const toolPromise = Promise.resolve(tool.execute(parsedArgs.data, { signal: options.signal }))
      const data = await raceWithTimeout(
        toolPromise,
        effectiveTimeout,
        `Tool '${name}' timed out after ${effectiveTimeout}ms.`
      )

      // 5. Post-execution verification (if configured)
      if (tool.verify) {
        const verifyStart = Date.now()
        const maxVerifyRetries = Math.min(Math.max(0, tool.maxVerificationRetries ?? 1), 5)
        let verifyAttempts = 0
        let verificationResult: VerificationResult = { outcome: 'inconclusive' }

        while (verifyAttempts <= maxVerifyRetries) {
          verifyAttempts++
          const elapsed = Date.now() - start
          const remainingVerifyTime = Math.max(10, effectiveTimeout - elapsed)

          try {
            const vPromise = Promise.resolve(tool.verify(data, parsedArgs.data, { signal: options.signal }))
            const vRes = await raceWithTimeout(
              vPromise,
              remainingVerifyTime,
              `Verification for tool '${name}' timed out after ${remainingVerifyTime}ms.`
            )

            if (typeof vRes === 'boolean') {
              verificationResult = {
                outcome: vRes ? 'passed' : 'failed',
                details: vRes ? undefined : 'Tool post-execution verification returned false.',
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
          } catch (err) {
            verificationResult = {
              outcome: 'inconclusive',
              error: err instanceof Error ? err.message : String(err),
              attempts: verifyAttempts,
              durationMs: Date.now() - verifyStart,
            }
          }
        }

        if (verificationResult.outcome === 'failed') {
          return {
            success: false,
            toolName: name,
            data,
            error: `Tool '${name}' executed, but post-execution verification failed: ${
              verificationResult.details || 'Check failed.'
            }`,
            errorCode: 'VERIFICATION_FAILED',
            durationMs: Date.now() - start,
            isReadOnly,
            verification: verificationResult,
          }
        }

        if (verificationResult.outcome === 'inconclusive') {
          return {
            success: false,
            toolName: name,
            data,
            error: `Tool '${name}' verification could not be completed: ${
              verificationResult.error || 'Verification encountered an error.'
            }`,
            errorCode: 'EXECUTION_ERROR',
            durationMs: Date.now() - start,
            isReadOnly,
            verification: verificationResult,
          }
        }

        return {
          success: true,
          toolName: name,
          data,
          durationMs: Date.now() - start,
          isReadOnly,
          verification: verificationResult,
        }
      }

      return {
        success: true,
        toolName: name,
        data,
        durationMs: Date.now() - start,
        isReadOnly,
        verification: { outcome: 'skipped' },
      }
    } catch (err) {
      const isTimeout = err instanceof Error && err.message.includes('timed out')
      const isCancelled = options.signal?.aborted || (err instanceof Error && err.message.includes('cancelled'))

      return {
        success: false,
        toolName: name,
        error: err instanceof Error ? err.message : String(err),
        errorCode: isCancelled ? 'CANCELLED' : isTimeout ? 'TIMEOUT' : 'EXECUTION_ERROR',
        durationMs: Date.now() - start,
        isReadOnly,
        verification: { outcome: 'skipped', error: 'Execution failed prior to verification' },
      }
    }
  }
}
