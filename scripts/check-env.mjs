#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

/**
 * Hackathon Starter — Environment Variable Diagnostic Tool (npm run env:check)
 *
 * Checks which provider API keys and services are configured without
 * ever printing, logging, or exposing the secret values themselves.
 */

// Parse .env.local if present
const rootDir = process.cwd()
const envLocalPath = path.join(rootDir, '.env.local')

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const content = fs.readFileSync(filePath, 'utf8')
  const env = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val = trimmed.slice(eqIdx + 1).trim()
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1)
    env[key] = val
  }
  return env
}

const localEnv = parseEnvFile(envLocalPath)
// Merge process.env with .env.local
const combinedEnv = { ...process.env, ...localEnv }

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

function isConfigured(value) {
  if (!value || typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed.length === 0) return false
  const lower = trimmed.toLowerCase()
  return !KNOWN_PLACEHOLDERS.some((ph) => lower.includes(ph))
}

const PROVIDERS = [
  {
    name: 'Google Gemini',
    variable: 'GOOGLE_GENERATIVE_AI_API_KEY',
    scope: 'SERVER',
    dashboard: 'https://aistudio.google.com/',
    check: () => isConfigured(combinedEnv['GOOGLE_GENERATIVE_AI_API_KEY']),
  },
  {
    name: 'OpenAI',
    variable: 'OPENAI_API_KEY',
    scope: 'SERVER',
    dashboard: 'https://platform.openai.com/api-keys',
    check: () => isConfigured(combinedEnv['OPENAI_API_KEY']),
  },
  {
    name: 'Anthropic Claude',
    variable: 'ANTHROPIC_API_KEY',
    scope: 'SERVER',
    dashboard: 'https://console.anthropic.com/',
    check: () => isConfigured(combinedEnv['ANTHROPIC_API_KEY']),
  },
  {
    name: 'Groq',
    variable: 'GROQ_API_KEY',
    scope: 'SERVER',
    dashboard: 'https://console.groq.com/',
    check: () => isConfigured(combinedEnv['GROQ_API_KEY']),
  },
  {
    name: 'Hugging Face',
    variable: 'HUGGINGFACE_API_KEY',
    scope: 'SERVER',
    dashboard: 'https://huggingface.co/settings/tokens',
    check: () => isConfigured(combinedEnv['HUGGINGFACE_API_KEY']),
  },
  {
    name: 'Tavily Search',
    variable: 'TAVILY_API_KEY',
    scope: 'SERVER',
    dashboard: 'https://app.tavily.com/',
    check: () => isConfigured(combinedEnv['TAVILY_API_KEY']),
  },
  {
    name: 'ElevenLabs',
    variable: 'ELEVENLABS_API_KEY',
    scope: 'SERVER',
    dashboard: 'https://elevenlabs.io/',
    check: () => isConfigured(combinedEnv['ELEVENLABS_API_KEY']),
  },
  {
    name: 'Supabase Project URL',
    variable: 'NEXT_PUBLIC_SUPABASE_URL',
    scope: 'CLIENT / SERVER',
    dashboard: 'https://supabase.com/dashboard',
    check: () => isConfigured(combinedEnv['NEXT_PUBLIC_SUPABASE_URL']),
  },
  {
    name: 'Supabase Publishable/Anon Key',
    variable: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    scope: 'CLIENT / SERVER',
    dashboard: 'https://supabase.com/dashboard',
    check: () =>
      isConfigured(combinedEnv['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) ||
      isConfigured(combinedEnv['NEXT_PUBLIC_SUPABASE_ANON_KEY']),
  },
  {
    name: 'Supabase Service Role Key',
    variable: 'SUPABASE_SERVICE_ROLE_KEY',
    scope: 'SERVER (ADMIN)',
    dashboard: 'https://supabase.com/dashboard',
    check: () => isConfigured(combinedEnv['SUPABASE_SERVICE_ROLE_KEY']),
  },
]

console.log('\n======================================================================')
console.log('   HACKATHON STARTER — ENVIRONMENT CONFIGURATION REPORT')
console.log('======================================================================\n')

const hasLocalFile = fs.existsSync(envLocalPath)
if (!hasLocalFile) {
  console.log('  ⚠️  .env.local file not found.')
  console.log('      To configure your keys, run: cp .env.example .env.local\n')
} else {
  console.log('  ✓  .env.local detected.\n')
}

let configuredCount = 0

console.log('Provider Status Overview (Values masked for security):')
console.log('----------------------------------------------------------------------')

for (const p of PROVIDERS) {
  const ready = p.check()
  if (ready) configuredCount++
  const statusStr = ready ? '✓ CONFIGURED' : '○ MISSING (Optional)'
  const scopeTag = `[${p.scope}]`.padEnd(17)

  console.log(` ${statusStr.padEnd(23)} ${p.name.padEnd(28)} ${scopeTag}`)
  console.log(`   Key: ${p.variable}`)
  if (!ready) {
    console.log(`   Get Key: ${p.dashboard}`)
  }
  console.log('')
}

console.log('----------------------------------------------------------------------')
console.log(`Summary: ${configuredCount} of ${PROVIDERS.length} provider keys configured.`)
console.log('Note: All provider keys are optional at startup. Add only what your project needs.')
console.log('======================================================================\n')

process.exit(0)
