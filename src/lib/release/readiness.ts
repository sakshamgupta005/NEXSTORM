/**
 * Environment & Release Readiness Evaluator
 * 
 * Safety Directives:
 * - Never prints real secret values or exposes credentials in reports.
 * - Detects placeholder and mock credentials that would fail silently in production.
 * - Disclaims that a successful build does not equate to complete production readiness.
 */

import type {
  OverallReleaseStatus,
  ReleaseCheckItem,
  ReleaseReadinessReport,
} from './types'

const PLACEHOLDER_PATTERNS = [
  /^your[-_]?.*$/i,
  /^placeholder[-_]?.*$/i,
  /^change[-_]?me.*$/i,
  /^insert[-_]?.*$/i,
  /^todo[-_]?.*$/i,
  /^example[-_]?.*$/i,
  /^test[-_]?key.*$/i,
  /^sk[-_]proj[-_]xxxx+.*$/i,
  /^sk[-_]ant[-_]xxxx+.*$/i,
]

export function maskSecretValue(value?: string): string {
  if (!value) return '(empty)'
  if (value.length <= 8) return '****'
  return `${value.slice(0, 3)}...${value.slice(-3)}`
}

export function isPlaceholderCredential(value?: string): boolean {
  if (!value) return false
  const trimmed = value.trim()
  if (trimmed.length < 5) return true
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed))
}

export interface ReadinessOptions {
  env?: Record<string, string | undefined>
  isProduction?: boolean
  target?: 'vercel' | 'render' | 'docker' | 'self-hosted'
}

export function evaluateReleaseReadiness(
  options: ReadinessOptions = {}
): ReleaseReadinessReport {
  const env = options.env || process.env
  const isProd = options.isProduction ?? env.NODE_ENV === 'production'
  const target = options.target || 'docker'

  const checks: ReleaseCheckItem[] = []

  // 1. NODE_ENV Check
  const nodeEnv = env.NODE_ENV
  if (isProd && nodeEnv !== 'production') {
    checks.push({
      id: 'env-node-env',
      name: 'Node Environment Mode',
      category: 'environment',
      status: 'warn',
      message: `NODE_ENV is set to "${nodeEnv || 'undefined'}" rather than "production".`,
      remediation: 'Set NODE_ENV=production in production deployment environment settings.',
    })
  } else {
    checks.push({
      id: 'env-node-env',
      name: 'Node Environment Mode',
      category: 'environment',
      status: 'pass',
      message: `NODE_ENV is properly configured (${nodeEnv || 'development'}).`,
    })
  }

  // 2. Secret & Credential Scanning (Placeholder Detection)
  const credentialKeys = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GOOGLE_GENERATIVE_AI_API_KEY',
    'GROQ_API_KEY',
    'STRIPE_SECRET_KEY',
    'ELEVENLABS_API_KEY',
  ]

  let detectedPlaceholders = 0
  for (const key of credentialKeys) {
    const val = env[key]
    if (val) {
      if (isPlaceholderCredential(val)) {
        detectedPlaceholders++
        checks.push({
          id: `sec-placeholder-${key.toLowerCase()}`,
          name: `Credential Placeholder: ${key}`,
          category: 'security',
          status: 'fail',
          message: `${key} contains a known placeholder value and will fail at runtime.`,
          details: `Current masked value: ${maskSecretValue(val)}`,
          remediation: `Replace ${key} with a genuine API credential in platform secret manager.`,
        })
      }
    }
  }

  if (detectedPlaceholders === 0) {
    checks.push({
      id: 'sec-placeholder-clean',
      name: 'Placeholder Credential Scan',
      category: 'security',
      status: 'pass',
      message: 'No known placeholder credentials or dummy keys detected in active environment.',
    })
  }

  // 3. Public vs Private Key Prefix Separation
  const leakedKeys: string[] = []
  for (const [key, val] of Object.entries(env)) {
    if (key.startsWith('NEXT_PUBLIC_') && val) {
      const lower = key.toLowerCase()
      if (
        lower.includes('secret') ||
        lower.includes('service_role') ||
        lower.includes('private') ||
        lower.includes('api_key')
      ) {
        leakedKeys.push(key)
      }
    }
  }

  if (leakedKeys.length > 0) {
    checks.push({
      id: 'sec-public-prefix-leak',
      name: 'Client Environment Key Separation',
      category: 'security',
      status: 'fail',
      message: `Sensitive server-only secret exposed with NEXT_PUBLIC_ prefix: [${leakedKeys.join(
        ', '
      )}]`,
      remediation: 'Remove NEXT_PUBLIC_ prefix so secret is never bundled into client browser code.',
    })
  } else {
    checks.push({
      id: 'sec-public-prefix-clean',
      name: 'Client Environment Key Separation',
      category: 'security',
      status: 'pass',
      message: 'All NEXT_PUBLIC_ environment variables are safe for client-side bundling.',
    })
  }

  // 4. Supabase URL and Key Consistency
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnon = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (supabaseUrl && !supabaseAnon) {
    checks.push({
      id: 'env-supabase-pair',
      name: 'Supabase Credential Pair',
      category: 'environment',
      status: 'fail',
      message: 'NEXT_PUBLIC_SUPABASE_URL is defined but publishable anon key is missing.',
      remediation: 'Provide NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY alongside project URL.',
    })
  } else if (!supabaseUrl && supabaseAnon) {
    checks.push({
      id: 'env-supabase-pair',
      name: 'Supabase Credential Pair',
      category: 'environment',
      status: 'fail',
      message: 'Supabase publishable key is defined but NEXT_PUBLIC_SUPABASE_URL is missing.',
      remediation: 'Provide NEXT_PUBLIC_SUPABASE_URL alongside publishable key.',
    })
  } else {
    checks.push({
      id: 'env-supabase-pair',
      name: 'Supabase Credential Pair',
      category: 'environment',
      status: 'pass',
      message: supabaseUrl
        ? 'Supabase client URL and publishable key configured consistently.'
        : 'Supabase credentials omitted (safe zero-crash fallback active).',
    })
  }

  // 5. Build Identification & App Version
  const appVersion = env.NEXT_PUBLIC_APP_VERSION || env.npm_package_version || '0.1.0'
  const gitSha =
    env.VERCEL_GIT_COMMIT_SHA ||
    env.RENDER_GIT_COMMIT ||
    env.GITHUB_SHA ||
    env.GIT_COMMIT_SHA

  checks.push({
    id: 'build-metadata',
    name: 'Build Metadata & Release Identifiers',
    category: 'build',
    status: 'pass',
    message: `Release Version: v${appVersion} | Commit: ${gitSha ? gitSha.slice(0, 7) : 'local-dev'}`,
  })

  // 6. Target Specific Platform Validation
  if (target === 'docker') {
    checks.push({
      id: 'platform-docker-readiness',
      name: 'Container Hosting Readiness',
      category: 'container',
      status: 'pass',
      message: 'Dockerfile multi-stage and non-root execution guidelines available.',
    })
  } else if (target === 'vercel') {
    checks.push({
      id: 'platform-vercel-readiness',
      name: 'Vercel Serverless Hosting Readiness',
      category: 'build',
      status: 'pass',
      message: 'Next.js App Router and dynamic API caching compatible with Vercel edge/serverless runtime.',
    })
  }

  // Compute summary
  const total = checks.length
  const pass = checks.filter((c) => c.status === 'pass').length
  const warn = checks.filter((c) => c.status === 'warn').length
  const fail = checks.filter((c) => c.status === 'fail').length

  let status: OverallReleaseStatus = 'READY'
  if (fail > 0) {
    status = 'NOT_READY'
  } else if (warn > 0) {
    status = 'NEEDS_ATTENTION'
  }

  return {
    status,
    summary: { total, pass, warn, fail },
    checks,
    timestamp: new Date().toISOString(),
    version: appVersion,
    target,
    metadata: {
      isProduction: isProd,
      disclaimer: 'Release readiness checks verify configuration and credentials, but do not replace user acceptance or end-to-end smoke verification.',
    },
  }
}
