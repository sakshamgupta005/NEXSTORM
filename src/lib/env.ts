/**
 * Environment Variable Validation & Safe Access Module
 *
 * Rules:
 * - Server secrets are NEVER exposed to client components.
 * - Missing optional keys DO NOT crash the application on startup.
 * - Keys are validated on-demand when the specific feature/service is called.
 * - Secret values are NEVER printed in error messages, logs, or reports.
 */

export class ConfigurationError extends Error {
  constructor(public readonly variableName: string, message: string) {
    super(message)
    this.name = 'ConfigurationError'
  }
}

const KNOWN_PLACEHOLDERS = [
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
 * Checks if a value is considered present and not a template placeholder.
 */
export function isValidEnvValue(value?: string): boolean {
  if (!value || typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed.length === 0) return false
  const lower = trimmed.toLowerCase()
  return !KNOWN_PLACEHOLDERS.some((ph) => lower.includes(ph))
}

export type ProviderKey =
  | 'GOOGLE_GENERATIVE_AI_API_KEY'
  | 'OPENAI_API_KEY'
  | 'ANTHROPIC_API_KEY'
  | 'GROQ_API_KEY'
  | 'HUGGINGFACE_API_KEY'
  | 'TAVILY_API_KEY'
  | 'ELEVENLABS_API_KEY'
  | 'SUPABASE_SERVICE_ROLE_KEY'

export interface EnvVariableMeta {
  key: string
  provider: string
  scope: 'server' | 'client'
  description: string
  dashboardUrl: string
  isOptional: boolean
}

export const ENV_REGISTRY: Record<string, EnvVariableMeta> = {
  GOOGLE_GENERATIVE_AI_API_KEY: {
    key: 'GOOGLE_GENERATIVE_AI_API_KEY',
    provider: 'Google Gemini',
    scope: 'server',
    description: 'Google AI Studio multimodal models (Gemini 2.5 / 1.5 Pro/Flash)',
    dashboardUrl: 'https://aistudio.google.com/',
    isOptional: true,
  },
  OPENAI_API_KEY: {
    key: 'OPENAI_API_KEY',
    provider: 'OpenAI',
    scope: 'server',
    description: 'GPT-4o, reasoning models, text embeddings, Whisper',
    dashboardUrl: 'https://platform.openai.com/api-keys',
    isOptional: true,
  },
  ANTHROPIC_API_KEY: {
    key: 'ANTHROPIC_API_KEY',
    provider: 'Anthropic Claude',
    scope: 'server',
    description: 'Claude 3.5 Sonnet / Haiku for deep reasoning and code generation',
    dashboardUrl: 'https://console.anthropic.com/',
    isOptional: true,
  },
  GROQ_API_KEY: {
    key: 'GROQ_API_KEY',
    provider: 'Groq',
    scope: 'server',
    description: 'Ultra-fast Llama 3 / Mixtral LPUs for real-time inference',
    dashboardUrl: 'https://console.groq.com/',
    isOptional: true,
  },
  HUGGINGFACE_API_KEY: {
    key: 'HUGGINGFACE_API_KEY',
    provider: 'Hugging Face',
    scope: 'server',
    description: 'Open-source models and Serverless Inference APIs',
    dashboardUrl: 'https://huggingface.co/settings/tokens',
    isOptional: true,
  },
  TAVILY_API_KEY: {
    key: 'TAVILY_API_KEY',
    provider: 'Tavily Search',
    scope: 'server',
    description: 'Search engine optimized for AI agents and RAG pipelines',
    dashboardUrl: 'https://app.tavily.com/',
    isOptional: true,
  },
  ELEVENLABS_API_KEY: {
    key: 'ELEVENLABS_API_KEY',
    provider: 'ElevenLabs',
    scope: 'server',
    description: 'Realistic text-to-speech and AI voice generation',
    dashboardUrl: 'https://elevenlabs.io/',
    isOptional: true,
  },
  NEXT_PUBLIC_SUPABASE_URL: {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    provider: 'Supabase',
    scope: 'client',
    description: 'Supabase project HTTPS endpoint',
    dashboardUrl: 'https://supabase.com/dashboard',
    isOptional: true,
  },
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: {
    key: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    provider: 'Supabase',
    scope: 'client',
    description: 'Supabase public anon / publishable key (JWT)',
    dashboardUrl: 'https://supabase.com/dashboard',
    isOptional: true,
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    provider: 'Supabase Admin',
    scope: 'server',
    description: 'Privileged admin service-role key (server-only)',
    dashboardUrl: 'https://supabase.com/dashboard',
    isOptional: true,
  },
}

/**
 * On-demand server-side validation.
 * Throws a clean descriptive ConfigurationError without exposing the value.
 */
export function requireServerEnv(key: ProviderKey, featureName?: string): string {
  // Runtime safeguard to avoid running in real browser
  if (typeof window !== 'undefined' && !process.env.VITEST) {
    throw new ConfigurationError(
      key,
      `Security violation: Attempted to access server-only secret "${key}" in the browser!`
    )
  }

  const value = process.env[key]
  if (!isValidEnvValue(value)) {
    const featureContext = featureName ? ` to use ${featureName}` : ''
    const meta = ENV_REGISTRY[key]
    const dashboardNote = meta?.dashboardUrl ? ` (obtain at: ${meta.dashboardUrl})` : ''
    throw new ConfigurationError(
      key,
      `Missing required environment variable: "${key}"${featureContext}. Please configure this key in your .env.local file${dashboardNote}.`
    )
  }

  return value!.trim()
}

/**
 * Safe accessor returning string or undefined without throwing.
 */
export function getServerEnv(key: ProviderKey): string | undefined {
  if (typeof window !== 'undefined' && !process.env.VITEST) return undefined
  const value = process.env[key]
  return isValidEnvValue(value) ? value!.trim() : undefined
}

/**
 * Check if a specific variable is configured.
 */
export function isEnvConfigured(key: string): boolean {
  if (key === 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') {
    return (
      isValidEnvValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
      isValidEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    )
  }
  return isValidEnvValue(process.env[key])
}

export interface EnvStatus {
  key: string
  provider: string
  scope: 'server' | 'client'
  isConfigured: boolean
  isOptional: boolean
  dashboardUrl: string
  description: string
}

/**
 * Inspects all registered environment variables for inspection and reports without leaking values.
 */
export function inspectEnvironment(): EnvStatus[] {
  return Object.values(ENV_REGISTRY).map((meta) => ({
    key: meta.key,
    provider: meta.provider,
    scope: meta.scope,
    isConfigured: isEnvConfigured(meta.key),
    isOptional: meta.isOptional,
    dashboardUrl: meta.dashboardUrl,
    description: meta.description,
  }))
}
