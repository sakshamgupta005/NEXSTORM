import type {
  EvaluationContext,
  FeatureFlagDefinition,
  FlagEvaluationResult,
  IFeatureFlagProvider,
  RuntimeEnvironment,
} from './types'
import { extractEnvFlags, getEnvironment } from './runtime'

/**
 * 32-bit FNV-1a hash algorithm for deterministic percentage-based rollouts
 */
export function calculateRolloutBucket(flagKey: string, targetingKey: string): number {
  const combined = `${flagKey}:${targetingKey}`
  let hash = 0x811c9dc5

  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }

  // Map to 0..99
  return ((hash >>> 0) % 100)
}

/**
 * Evaluates a feature flag definition against evaluation context following strict precedence rules
 */
export function evaluateFlagWithReason(
  definition: FeatureFlagDefinition,
  context?: EvaluationContext,
  runtimeOverrides?: Map<string, boolean>
): FlagEvaluationResult {
  const currentEnv: RuntimeEnvironment = context?.environment || getEnvironment()
  const targetingKey = context?.targetingKey || context?.userId

  // 1. Emergency Kill-Switch: Immediate disablement
  if (definition.emergencyKillSwitch === true) {
    return {
      key: definition.key,
      enabled: false,
      reason: 'emergency_kill_switch',
    }
  }

  // 2. Manual / Runtime override
  if (runtimeOverrides && runtimeOverrides.has(definition.key)) {
    return {
      key: definition.key,
      enabled: runtimeOverrides.get(definition.key)!,
      reason: 'manual_override',
    }
  }

  // 3. User Allowlist / Targeting
  if (targetingKey && definition.allowedUsers && definition.allowedUsers.length > 0) {
    if (definition.allowedUsers.includes(targetingKey)) {
      return {
        key: definition.key,
        enabled: true,
        reason: 'user_targeting',
      }
    }
  }

  // 4. Role Targeting
  if (context?.userRole && definition.requiredRoles && definition.requiredRoles.length > 0) {
    if (definition.requiredRoles.includes(context.userRole)) {
      return {
        key: definition.key,
        enabled: true,
        reason: 'role_targeting',
      }
    }
  }

  // 5. Environment Availability Constraint
  if (definition.enabledEnvironments && definition.enabledEnvironments.length > 0) {
    if (!definition.enabledEnvironments.includes(currentEnv)) {
      return {
        key: definition.key,
        enabled: false,
        reason: 'environment_disabled',
      }
    }
  }

  // 6. Deterministic Percentage Rollout
  if (typeof definition.percentageRollout === 'number' && targetingKey) {
    const bucket = calculateRolloutBucket(definition.key, targetingKey)
    const inRollout = bucket < definition.percentageRollout
    return {
      key: definition.key,
      enabled: inRollout,
      reason: 'percentage_rollout',
    }
  }

  // 7. Static Default Value
  return {
    key: definition.key,
    enabled: definition.defaultValue,
    reason: 'default_value',
  }
}

/**
 * In-memory provider for local definition storage and test fixtures
 */
export class InMemoryFeatureFlagProvider implements IFeatureFlagProvider {
  public readonly name = 'in-memory'
  private flags = new Map<string, FeatureFlagDefinition>()

  constructor(initialFlags: FeatureFlagDefinition[] = []) {
    for (const flag of initialFlags) {
      this.flags.set(flag.key, flag)
    }
  }

  public register(flag: FeatureFlagDefinition): void {
    this.flags.set(flag.key, flag)
  }

  public isEnabled(flagKey: string, context?: EvaluationContext): boolean {
    const def = this.flags.get(flagKey)
    if (!def) return false
    return evaluateFlagWithReason(def, context).enabled
  }

  public getFlag(flagKey: string): FeatureFlagDefinition | undefined {
    return this.flags.get(flagKey)
  }
}

/**
 * Provider reading flags dynamically from environment variables
 */
export class EnvFeatureFlagProvider implements IFeatureFlagProvider {
  public readonly name = 'env'

  public isEnabled(flagKey: string): boolean {
    const normalizedKey = flagKey.toLowerCase().replace(/_/g, '-')
    const envFlags = extractEnvFlags()
    return envFlags[normalizedKey] ?? false
  }
}

/**
 * Unified Feature Flag Manager supporting multiple providers, overrides, and fallbacks
 */
export class FeatureFlagManager {
  private definitions = new Map<string, FeatureFlagDefinition>()
  private overrides = new Map<string, boolean>()
  private providers: IFeatureFlagProvider[] = []
  private listeners = new Set<() => void>()

  constructor() {
    // Add default env provider
    this.providers.push(new EnvFeatureFlagProvider())
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener()
      } catch {
        // Safe listener execution
      }
    }
  }

  public registerFlag(def: FeatureFlagDefinition): void {
    this.definitions.set(def.key, def)
    this.notifyListeners()
  }

  public addProvider(provider: IFeatureFlagProvider): void {
    this.providers.push(provider)
    this.notifyListeners()
  }

  public setOverride(flagKey: string, enabled: boolean | null): void {
    if (enabled === null) {
      this.overrides.delete(flagKey)
    } else {
      this.overrides.set(flagKey, enabled)
    }
    this.notifyListeners()
  }

  public clearOverrides(): void {
    this.overrides.clear()
    this.notifyListeners()
  }

  public isEnabled(flagKey: string, context?: EvaluationContext): boolean {
    // 1. Check local runtime overrides
    if (this.overrides.has(flagKey)) {
      return this.overrides.get(flagKey)!
    }

    // 2. Check registered definitions
    const def = this.definitions.get(flagKey)
    if (def) {
      return evaluateFlagWithReason(def, context, this.overrides).enabled
    }

    // 3. Fallback to external providers in priority order
    for (const provider of this.providers) {
      try {
        const result = provider.isEnabled(flagKey, context)
        if (typeof result === 'boolean') {
          return result
        }
      } catch {
        // Safe fallback if a remote or external provider fails
        continue
      }
    }

    // Default: false if flag is completely unregistered
    return false
  }

  public evaluateWithReason(flagKey: string, context?: EvaluationContext): FlagEvaluationResult {
    const def = this.definitions.get(flagKey)
    if (def) {
      return evaluateFlagWithReason(def, context, this.overrides)
    }

    const enabled = this.isEnabled(flagKey, context)
    return {
      key: flagKey,
      enabled,
      reason: this.overrides.has(flagKey) ? 'manual_override' : 'fallback',
    }
  }

  public getAllFlags(context?: EvaluationContext): Record<string, boolean> {
    const result: Record<string, boolean> = {}
    for (const key of this.definitions.keys()) {
      result[key] = this.isEnabled(key, context)
    }
    return result
  }
}

// Global singleton instance
export const featureFlagManager = new FeatureFlagManager()

/**
 * Convenient helper for checking feature flag state on the server or in utility functions
 */
export function isFeatureEnabled(flagKey: string, context?: EvaluationContext): boolean {
  return featureFlagManager.isEnabled(flagKey, context)
}
