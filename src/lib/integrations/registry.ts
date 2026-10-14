/**
 * Modular Integration Framework — Registry & Adapter Harness
 * 
 * Capabilities:
 * - Dynamic registration of capability adapters
 * - Unique ID and category indexing
 * - Configuration & env-var requirement checks (never crashes on missing optional keys)
 * - Schema validation via Zod
 * - Strict timeout and AbortSignal cancellation
 * - Normalized error objects (never throws unexpected exceptions)
 * - Health check probes & metadata inspection
 */

import { z } from 'zod'
import type {
  IntegrationCategory,
  IntegrationErrorCode,
  IntegrationHealth,
  IntegrationResult,
  ExecutionOptions,
} from './types'

export interface IntegrationAdapter<TInput = unknown, TOutput = unknown> {
  execute: (input: TInput, options?: ExecutionOptions) => Promise<TOutput>
  checkHealth?: () => Promise<IntegrationHealth>
}

export interface IntegrationDefinition<
  TInput = unknown,
  TOutput = unknown,
  TConfig = Record<string, unknown>
> {
  id: string
  category: IntegrationCategory
  name: string
  description: string
  referenceRepo: string
  license: string
  requiredEnvVars?: string[]
  optionalDependencies?: string[]
  inputSchema?: z.ZodType<TInput>
  isConfigured: (config?: TConfig) => boolean
  checkHealth?: (config?: TConfig) => Promise<IntegrationHealth>
  createAdapter: (config?: TConfig) => IntegrationAdapter<TInput, TOutput>
}

export interface RegisterOptions {
  overwrite?: boolean
}

function raceWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage: string
): Promise<T> {
  let timer: NodeJS.Timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(errorMessage)
      error.name = 'TimeoutError'
      reject(error)
    }, ms)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer)
  })
}

export type AnyIntegrationDefinition = IntegrationDefinition<unknown, unknown, Record<string, unknown>>

export class IntegrationRegistry {
  private definitions = new Map<string, AnyIntegrationDefinition>()

  /**
   * Registers a capability integration.
   * Throws an error on duplicate IDs unless overwrite: true is passed.
   */
  register<TInput, TOutput, TConfig>(
    definition: IntegrationDefinition<TInput, TOutput, TConfig>,
    options?: RegisterOptions
  ): this {
    if (!definition.id || typeof definition.id !== 'string') {
      throw new Error('Integration registration failed: "id" must be a non-empty string')
    }
    if (!definition.category) {
      throw new Error(`Integration registration failed for "${definition.id}": "category" is required`)
    }
    if (typeof definition.createAdapter !== 'function') {
      throw new Error(`Integration registration failed for "${definition.id}": "createAdapter" must be a function`)
    }

    if (this.definitions.has(definition.id) && !options?.overwrite) {
      throw new Error(
        `Integration "${definition.id}" is already registered. Pass overwrite: true to replace.`
      )
    }

    this.definitions.set(definition.id, definition as unknown as AnyIntegrationDefinition)
    return this
  }

  unregister(id: string): boolean {
    return this.definitions.delete(id)
  }

  get<TInput = unknown, TOutput = unknown, TConfig = Record<string, unknown>>(
    id: string
  ): IntegrationDefinition<TInput, TOutput, TConfig> | undefined {
    return this.definitions.get(id) as unknown as
      | IntegrationDefinition<TInput, TOutput, TConfig>
      | undefined
  }

  has(id: string): boolean {
    return this.definitions.has(id)
  }

  list(category?: IntegrationCategory): IntegrationDefinition[] {
    const all = Array.from(this.definitions.values())
    if (!category) return all
    return all.filter((d) => d.category === category)
  }

  /**
   * Returns list of integrations whose required configuration is fulfilled.
   */
  getAvailable(category?: IntegrationCategory): IntegrationDefinition[] {
    return this.list(category).filter((d) => {
      try {
        return d.isConfigured()
      } catch {
        return false
      }
    })
  }

  /**
   * Performs an optional health check for a given integration.
   */
  async checkHealth(
    id: string,
    config?: Record<string, unknown>
  ): Promise<IntegrationHealth> {
    const def = this.get(id)
    if (!def) {
      return {
        status: 'unhealthy',
        message: `Integration "${id}" is not registered`,
        timestamp: Date.now(),
      }
    }

    if (!def.isConfigured(config)) {
      const missing = def.requiredEnvVars?.join(', ') || 'environment variables'
      return {
        status: 'unhealthy',
        message: `Integration "${id}" is not configured. Missing required: ${missing}`,
        timestamp: Date.now(),
      }
    }

    if (typeof def.checkHealth === 'function') {
      const start = Date.now()
      try {
        const health = await def.checkHealth(config)
        return {
          ...health,
          latencyMs: Date.now() - start,
          timestamp: Date.now(),
        }
      } catch (err) {
        return {
          status: 'unhealthy',
          message: err instanceof Error ? err.message : String(err),
          latencyMs: Date.now() - start,
          timestamp: Date.now(),
        }
      }
    }

    return {
      status: 'healthy',
      message: `Integration "${id}" is configured and ready`,
      timestamp: Date.now(),
    }
  }

  /**
   * Executes an integration with strict validation, timeout, cancellation, and error normalization.
   * NEVER throws uncaught errors — always returns a structured IntegrationResult.
   */
  async execute<TInput, TOutput>(
    id: string,
    input: TInput,
    options?: ExecutionOptions
  ): Promise<IntegrationResult<TOutput>> {
    const startTime = Date.now()

    const def = this.get<TInput, TOutput>(id)
    if (!def) {
      return {
        success: false,
        error: `Integration "${id}" is not registered`,
        errorDetail: {
          code: 'NOT_REGISTERED',
          message: `Integration "${id}" is not registered. Registered integrations: ${Array.from(
            this.definitions.keys()
          ).join(', ') || 'none'}`,
        },
        latencyMs: 0,
        integrationId: id,
      }
    }

    // Check configuration
    if (!def.isConfigured(options?.config)) {
      const missing = def.requiredEnvVars?.join(', ') || 'required configuration'
      return {
        success: false,
        error: `Integration "${id}" is not configured. Missing: ${missing}`,
        errorDetail: {
          code: 'NOT_CONFIGURED',
          message: `Integration "${id}" requires configuration: ${missing}`,
          details: {
            requiredEnvVars: def.requiredEnvVars,
            referenceRepo: def.referenceRepo,
          },
        },
        latencyMs: 0,
        integrationId: id,
      }
    }

    // Check pre-aborted signal
    if (options?.signal?.aborted) {
      return {
        success: false,
        error: `Execution of "${id}" was aborted`,
        errorDetail: {
          code: 'CANCELLED',
          message: `Execution was aborted before starting`,
        },
        latencyMs: 0,
        integrationId: id,
      }
    }

    // Input schema validation (if present)
    let validatedInput = input
    if (def.inputSchema) {
      const parseResult = def.inputSchema.safeParse(input)
      if (!parseResult.success) {
        return {
          success: false,
          error: `Invalid input for integration "${id}": ${parseResult.error.message}`,
          errorDetail: {
            code: 'INVALID_INPUT',
            message: parseResult.error.message,
            details: { errors: parseResult.error.issues },
          },
          latencyMs: Date.now() - startTime,
          integrationId: id,
        }
      }
      validatedInput = parseResult.data
    }

    try {
      const adapter = def.createAdapter(options?.config)

      let executionPromise = adapter.execute(validatedInput, options)

      // Signal cancellation listener
      if (options?.signal) {
        const signal = options.signal
        const abortPromise = new Promise<never>((_, reject) => {
          signal.addEventListener(
            'abort',
            () => {
              const err = new Error('Execution aborted by signal')
              err.name = 'AbortError'
              reject(err)
            },
            { once: true }
          )
        })
        executionPromise = Promise.race([executionPromise, abortPromise])
      }

      // Timeout race
      if (options?.timeoutMs && options.timeoutMs > 0) {
        executionPromise = raceWithTimeout(
          executionPromise,
          options.timeoutMs,
          `Integration "${id}" timed out after ${options.timeoutMs}ms`
        )
      }

      const data = await executionPromise
      const latencyMs = Date.now() - startTime

      return {
        success: true,
        data,
        latencyMs,
        integrationId: id,
        metadata: {
          category: def.category,
          name: def.name,
        },
      }
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime
      const errorMessage = err instanceof Error ? err.message : String(err)
      const errorName = err instanceof Error ? err.name : 'Error'

      let errorCode: IntegrationErrorCode = 'EXECUTION_ERROR'
      if (errorName === 'TimeoutError' || errorMessage.includes('timed out')) {
        errorCode = 'TIMEOUT'
      } else if (errorName === 'AbortError' || errorMessage.includes('aborted')) {
        errorCode = 'CANCELLED'
      }

      return {
        success: false,
        error: errorMessage,
        errorDetail: {
          code: errorCode,
          message: errorMessage,
          recoverable: errorCode === 'TIMEOUT',
        },
        latencyMs,
        integrationId: id,
        metadata: {
          category: def.category,
        },
      }
    }
  }

  clear(): void {
    this.definitions.clear()
  }
}

export function createIntegrationRegistry(): IntegrationRegistry {
  return new IntegrationRegistry()
}

export const defaultIntegrationRegistry = createIntegrationRegistry()
