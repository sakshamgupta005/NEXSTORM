#!/usr/bin/env node

/**
 * Release Readiness Audit CLI
 * 
 * Evaluates environment configuration, detects placeholder secrets,
 * and verifies deployment prerequisite compliance.
 * 
 * Usage:
 *   node scripts/release-check.mjs [--prod] [--target=docker|vercel|render]
 */

const isProd = process.argv.includes('--prod') || process.env.NODE_ENV === 'production'
const targetArg = process.argv.find((a) => a.startsWith('--target='))
const target = targetArg ? targetArg.split('=')[1] : 'docker'

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

function maskSecret(val) {
  if (!val) return '(empty)'
  if (val.length <= 8) return '****'
  return `${val.slice(0, 3)}...${val.slice(-3)}`
}

console.log('='.repeat(70))
console.log('Production Release Readiness Audit')
console.log(`Environment: ${isProd ? 'Production' : 'Development'} | Target: ${target}`)
console.log('='.repeat(70))

const checks = []

// 1. NODE_ENV Check
const nodeEnv = process.env.NODE_ENV
if (isProd && nodeEnv !== 'production') {
  checks.push({
    status: 'WARN',
    name: 'NODE_ENV Mode',
    msg: `NODE_ENV is "${nodeEnv || 'undefined'}" instead of "production"`,
  })
} else {
  checks.push({
    status: 'PASS',
    name: 'NODE_ENV Mode',
    msg: `Configured as "${nodeEnv || 'development'}"`,
  })
}

// 2. Placeholder secrets scan
const sensitiveKeys = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'GROQ_API_KEY',
  'STRIPE_SECRET_KEY',
  'ELEVENLABS_API_KEY',
]

let placeholders = 0
for (const key of sensitiveKeys) {
  const val = process.env[key]
  if (val) {
    const isPlaceholder = val.trim().length < 5 || PLACEHOLDER_PATTERNS.some((p) => p.test(val.trim()))
    if (isPlaceholder) {
      placeholders++
      checks.push({
        status: 'FAIL',
        name: `Placeholder: ${key}`,
        msg: `Contains placeholder credentials (masked: ${maskSecret(val)})`,
      })
    }
  }
}

if (placeholders === 0) {
  checks.push({
    status: 'PASS',
    name: 'Secret Placeholders',
    msg: 'No placeholder dummy keys detected',
  })
}

// 3. Client Environment Key Separation
const publicLeaks = Object.keys(process.env).filter(
  (k) =>
    k.startsWith('NEXT_PUBLIC_') &&
    (k.includes('SECRET') || k.includes('PRIVATE') || k.includes('SERVICE_ROLE'))
)

if (publicLeaks.length > 0) {
  checks.push({
    status: 'FAIL',
    name: 'Client Key Separation',
    msg: `Server secrets exposed with NEXT_PUBLIC_ prefix: [${publicLeaks.join(', ')}]`,
  })
} else {
  checks.push({
    status: 'PASS',
    name: 'Client Key Separation',
    msg: 'All NEXT_PUBLIC_ variables safe for client bundling',
  })
}

// 4. Supabase Pair
const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const sbKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (Boolean(sbUrl) !== Boolean(sbKey)) {
  checks.push({
    status: 'FAIL',
    name: 'Supabase Pair',
    msg: 'Mismatched URL and Anon key (one is present, the other missing)',
  })
} else {
  checks.push({
    status: 'PASS',
    name: 'Supabase Pair',
    msg: sbUrl ? 'URL and publishable key configured' : 'Omitted (safe fallback active)',
  })
}

for (const c of checks) {
  const icon = c.status === 'PASS' ? '✔ PASS' : c.status === 'WARN' ? '⚠ WARN' : '✖ FAIL'
  console.log(` ${icon}  ${c.name.padEnd(25)} - ${c.msg}`)
}

const fails = checks.filter((c) => c.status === 'FAIL').length
const warns = checks.filter((c) => c.status === 'WARN').length
const passes = checks.filter((c) => c.status === 'PASS').length

console.log('-'.repeat(70))
console.log(`Summary: ${passes} passed, ${warns} warnings, ${fails} failed`)
console.log('> Note: Release readiness verifies configuration, but does not guarantee product-market fit.')
console.log('='.repeat(70))

if (fails > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
