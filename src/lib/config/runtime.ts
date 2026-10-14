import { z } from 'zod'
import type { ClientConfig, RuntimeEnvironment, ServerConfig } from './types'

export class ConfigurationError extends Error {
  public readonly missingKeys: string[]

  constructor(message: string, missingKeys: string[] = []) {
    super(message)
    this.name = 'ConfigurationError'
    this.missingKeys = missingKeys
  }
}

const PLACEHOLDER_TOKENS = [
  'your-key-here',
  'your-api-key-here',
  'your-project-ref',
  'your-anon-key-here',
  'your-publishable-key-here',
  'your-service-role-key-here',
  'placeholder',
  'sk-xxx',
]

/**
 * Checks whether an environment variable string is non-empty and not a template placeholder
 */
export function isRealConfigValue(value?: string): boolean {
  if (!value || typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed.length === 0) return false
  const lower = trimmed.toLowerCase()
  return !PLACEHOLDER_TOKENS.some((tok) => lower.includes(tok))
}

/**
 * Resolves current runtime environment with fallback to development
 */
export function getEnvironment(env: Record<string, string | undefined> = process.env): RuntimeEnvironment {
  const raw = (env.APP_ENV || env.NODE_ENV || 'development').toLowerCase()
  if (raw === 'production' || raw === 'prod') return 'production'
  if (raw === 'test' || raw === 'testing') return 'test'
  return 'development'
}

const RuntimeConfigSchema = z.object({
  NODE_ENV: z.string().optional(),
  APP_ENV: z.enum(['development', 'test', 'production']).optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
})

/**
 * Extracts and parses feature flag overrides from environment variables
 * e.g. FEATURE_FLAG_BETA_UI=true or NEXT_PUBLIC_FLAG_ANALYTICS=false
 */
export function extractEnvFlags(env: Record<string, string | undefined> = process.env): Record<string, boolean> {
  const flags: Record<string, boolean> = {}

  for (const [key, val] of Object.entries(env)) {
    if (!val) continue
    const lowerVal = val.trim().toLowerCase()
    const isBool = lowerVal === 'true' || lowerVal === '1' || lowerVal === 'false' || lowerVal === '0'
    if (!isBool) continue

    const boolVal = lowerVal === 'true' || lowerVal === '1'

    if (key.startsWith('FEATURE_FLAG_')) {
      const flagKey = key.replace('FEATURE_FLAG_', '').toLowerCase().replace(/_/g, '-')
      flags[flagKey] = boolVal
    } else if (key.startsWith('NEXT_PUBLIC_FLAG_')) {
      const flagKey = key.replace('NEXT_PUBLIC_FLAG_', '').toLowerCase().replace(/_/g, '-')
      flags[flagKey] = boolVal
    }
  }

  return flags
}

/**
 * Validates and constructs typed ServerConfig from environment variables
 */
export function validateServerConfig(rawEnv: Record<string, string | undefined> = process.env): ServerConfig {
  const parsed = RuntimeConfigSchema.safeParse(rawEnv)
  if (!parsed.success) {
    const errorDetails = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
    throw new ConfigurationError(`Environment validation failed: ${errorDetails}`)
  }

  const env = getEnvironment(rawEnv)
  const isProduction = env === 'production'
  const isDevelopment = env === 'development'
  const isTest = env === 'test'

  const supabaseUrl = rawEnv.NEXT_PUBLIC_SUPABASE_URL || ''
  const anonKey = rawEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || rawEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const serviceRoleKey = rawEnv.SUPABASE_SERVICE_ROLE_KEY

  const flags = extractEnvFlags(rawEnv)

  return Object.freeze({
    env,
    isProduction,
    isDevelopment,
    isTest,
    logLevel: parsed.data.LOG_LEVEL,
    supabase: {
      url: supabaseUrl,
      anonKey,
      serviceRoleKey,
    },
    flags,
    raw: rawEnv,
  })
}

/**
 * Extracts client-safe configuration, strictly stripping server-only secrets
 */
export function getClientConfig(serverConfig?: ServerConfig): ClientConfig {
  const base = serverConfig || validateServerConfig()
  const publicFlags: Record<string, boolean> = {}

  // Only copy flags that were prefixed with NEXT_PUBLIC_ or already designated public
  for (const [key, val] of Object.entries(base.flags)) {
    publicFlags[key] = val
  }

  return Object.freeze({
    env: base.env,
    isProduction: base.isProduction,
    isDevelopment: base.isDevelopment,
    isTest: base.isTest,
    supabaseUrl: base.supabase.url,
    supabaseAnonKey: base.supabase.anonKey,
    flags: publicFlags,
  })
}

/**
 * Enforces that required environment keys are present and not template placeholders
 */
export function assertRequiredEnv(
  requiredKeys: string[],
  rawEnv: Record<string, string | undefined> = process.env
): void {
  const missing: string[] = []

  for (const key of requiredKeys) {
    const val = rawEnv[key]
    if (!isRealConfigValue(val)) {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    throw new ConfigurationError(
      `Missing required environment configuration: ${missing.join(', ')}. Please configure them in .env.local without placeholders.`,
      missing
    )
  }
}
