/**
 * Quality Gate Verification System
 * 
 * Capabilities:
 * - Configurable quality gates (typecheck, lint, test, build, custom checks)
 * - Required vs. optional gate enforcement
 * - Guard against false success: a gate only passes if it actually ran and succeeded
 * - Structured execution telemetry (duration, output, errors)
 */

export type QualityGateType = 'typecheck' | 'lint' | 'test' | 'build' | 'custom'

export interface QualityGateResult {
  gateId: string
  gateName: string
  type: QualityGateType
  isRequired: boolean
  passed: boolean
  durationMs: number
  error?: string
  output?: string
  skipped?: boolean
}

export interface QualityGateContext {
  signal?: AbortSignal
  timeoutMs?: number
}

export interface QualityGate {
  id: string
  name: string
  type: QualityGateType
  /** If true, the overall suite cannot pass unless this gate passes */
  isRequired: boolean
  run: (context?: QualityGateContext) => Promise<QualityGateResult> | QualityGateResult
}

export interface QualityGateSuiteResult {
  allPassed: boolean
  requiredPassed: boolean
  totalDurationMs: number
  results: QualityGateResult[]
  failedGates: QualityGateResult[]
  passedGates: QualityGateResult[]
}

export class QualityGateSuite {
  private gates = new Map<string, QualityGate>()

  addGate(gate: QualityGate): this {
    if (!gate || typeof gate !== 'object') {
      throw new Error('Quality gate must be an object.')
    }
    if (!gate.id || typeof gate.id !== 'string') {
      throw new Error('Quality gate must have a valid string id.')
    }
    if (!gate.name || typeof gate.name !== 'string') {
      throw new Error(`Quality gate '${gate.id}' must have a valid name.`)
    }
    if (typeof gate.run !== 'function') {
      throw new Error(`Quality gate '${gate.id}' must provide a run function.`)
    }
    if (this.gates.has(gate.id)) {
      throw new Error(`Quality gate '${gate.id}' is already registered. IDs must be unique.`)
    }

    this.gates.set(gate.id, gate)
    return this
  }

  getGate(id: string): QualityGate | undefined {
    return this.gates.get(id)
  }

  listGates(): QualityGate[] {
    return Array.from(this.gates.values())
  }

  async runAll(context?: QualityGateContext): Promise<QualityGateSuiteResult> {
    const startTime = Date.now()
    const results: QualityGateResult[] = []

    for (const gate of this.gates.values()) {
      if (context?.signal?.aborted) {
        results.push({
          gateId: gate.id,
          gateName: gate.name,
          type: gate.type,
          isRequired: gate.isRequired,
          passed: false,
          durationMs: 0,
          error: 'Quality check cancelled by signal.',
          skipped: true,
        })
        continue
      }

      const gateStart = Date.now()
      try {
        const res = await Promise.resolve(gate.run(context))
        results.push({
          ...res,
          gateId: gate.id,
          gateName: gate.name,
          type: gate.type,
          isRequired: gate.isRequired,
          durationMs: res.durationMs || Date.now() - gateStart,
        })
      } catch (err) {
        results.push({
          gateId: gate.id,
          gateName: gate.name,
          type: gate.type,
          isRequired: gate.isRequired,
          passed: false,
          durationMs: Date.now() - gateStart,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    const failedGates = results.filter((r) => !r.passed)
    const passedGates = results.filter((r) => r.passed)
    const requiredPassed = results.filter((r) => r.isRequired).every((r) => r.passed)
    const allPassed = results.every((r) => r.passed)

    return {
      allPassed,
      requiredPassed,
      totalDurationMs: Date.now() - startTime,
      results,
      failedGates,
      passedGates,
    }
  }
}

/**
 * Creates a helper QualityGate object easily for unit tests or custom integrations.
 */
export function createQualityGate(
  id: string,
  name: string,
  type: QualityGateType,
  isRequired: boolean,
  checkFn: () => Promise<boolean | { passed: boolean; output?: string; error?: string }> | boolean | { passed: boolean; output?: string; error?: string }
): QualityGate {
  return {
    id,
    name,
    type,
    isRequired,
    run: async () => {
      const start = Date.now()
      const res = await Promise.resolve(checkFn())
      if (typeof res === 'boolean') {
        return {
          gateId: id,
          gateName: name,
          type,
          isRequired,
          passed: res,
          durationMs: Date.now() - start,
          error: res ? undefined : `Gate '${name}' check failed`,
        }
      }
      return {
        gateId: id,
        gateName: name,
        type,
        isRequired,
        passed: res.passed,
        durationMs: Date.now() - start,
        error: res.error,
        output: res.output,
      }
    },
  }
}
