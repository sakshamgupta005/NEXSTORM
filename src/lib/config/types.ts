/**
 * Reusable Feature Flags & Runtime Configuration Toolkit — Type Definitions
 */

export type RuntimeEnvironment = 'development' | 'test' | 'production'

export interface EvaluationContext {
  userId?: string
  targetingKey?: string
  userRole?: string
  environment?: RuntimeEnvironment
  attributes?: Record<string, unknown>
}

export interface FeatureFlagDefinition {
  key: string
  description?: string
  defaultValue: boolean
  enabledEnvironments?: RuntimeEnvironment[]
  /** Deterministic rollout percentage between 0 and 100 */
  percentageRollout?: number
  /** Targeted user IDs or targeting keys */
  allowedUsers?: string[]
  /** Targeted roles (e.g., 'admin', 'beta-tester') */
  requiredRoles?: string[]
  /** Emergency kill-switch: if true, immediately disables flag regardless of other rules */
  emergencyKillSwitch?: boolean
  /** Optional variant payload */
  variants?: Record<string, unknown>
}

export interface IFeatureFlagProvider {
  name: string
  isEnabled(flagKey: string, context?: EvaluationContext): Promise<boolean> | boolean
  getFlag?(flagKey: string, context?: EvaluationContext): Promise<FeatureFlagDefinition | undefined> | FeatureFlagDefinition | undefined
}

export interface ServerConfig {
  env: RuntimeEnvironment
  isProduction: boolean
  isDevelopment: boolean
  isTest: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  supabase: {
    url: string
    anonKey: string
    serviceRoleKey?: string
  }
  flags: Record<string, boolean>
  raw: Record<string, string | undefined>
}

export interface ClientConfig {
  env: RuntimeEnvironment
  isProduction: boolean
  isDevelopment: boolean
  isTest: boolean
  supabaseUrl: string
  supabaseAnonKey: string
  flags: Record<string, boolean>
}

export interface FlagEvaluationResult {
  key: string
  enabled: boolean
  reason:
    | 'emergency_kill_switch'
    | 'manual_override'
    | 'user_targeting'
    | 'role_targeting'
    | 'environment_disabled'
    | 'percentage_rollout'
    | 'default_value'
    | 'fallback'
}
