#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'

/**
 * Hackathon Project Initialization Script
 * 
 * Usage:
 *   node scripts/hackathon-init.mjs "AI Telehealth Triage" --desc "A voice-first triage assistant for rural clinics"
 *   node scripts/hackathon-init.mjs --file problem.md
 *   node scripts/hackathon-init.mjs --demo
 */

const args = process.argv.slice(2)

let title = 'Hackathon Project'
let description = 'Rapid prototype solving hackathon problem statement.'
let problemFile = null
let runCheck = args.includes('--check')

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--desc' && args[i + 1]) {
    description = args[i + 1]
    i++
  } else if (args[i] === '--file' && args[i + 1]) {
    problemFile = args[i + 1]
    i++
  } else if (args[i] === '--demo') {
    title = 'AI Telehealth Triage & Voice Diagnosis Assistant'
    description = 'A voice-first rural triage assistant enabling clinical intake, offline record capture, and AI symptom summaries.'
  } else if (!args[i].startsWith('--')) {
    title = args[i]
  }
}

if (problemFile && fs.existsSync(problemFile)) {
  const content = fs.readFileSync(problemFile, 'utf8')
  description = content
  const firstLine = content.split('\n')[0].replace(/^#+\s*/, '').trim()
  if (firstLine) title = firstLine
}

console.log('='.repeat(70))
console.log(' 🚀 Hackathon Starter — Project Initialization & Capability Selector')
console.log('='.repeat(70))
console.log(`\n📋 Title:       ${title}`)
console.log(`📝 Description: ${description.slice(0, 80)}...`)

// Baseline capability dictionary
const CAPABILITIES = [
  { id: 'safe-redirects', name: 'Safe Internal Redirects', cat: 'Security', keys: [], env: [] },
  { id: 'api-client-resilience', name: 'Resilient API Client', cat: 'Reliability', keys: ['fetch', 'api', 'retry'], env: [] },
  { id: 'structured-logger', name: 'Structured Logger & Redaction', cat: 'Observability', keys: ['log', 'audit'], env: ['LOG_LEVEL'] },
  { id: 'api-response', name: 'Standardized API Responses', cat: 'Reliability', keys: ['api', 'route'], env: [] },
  { id: 'health-probes', name: 'Health & Readiness Probes', cat: 'Reliability', keys: ['health', 'uptime'], env: [] },
  { id: 'security-headers', name: 'HTTP Security Headers', cat: 'Security', keys: ['security', 'csp'], env: [] },
  { id: 'rate-limiting', name: 'Rate Limiter', cat: 'Security', keys: ['rate', 'limit', 'throttle'], env: [] },
  { id: 'sanitization', name: 'Input & Output Sanitization', cat: 'Security', keys: ['sanitize', 'xss'], env: [] },
  { id: 'file-upload-security', name: 'File Upload Constraints', cat: 'Security', keys: ['upload', 'file', 'attachment'], env: [] },
  { id: 'supabase-auth-guard', name: 'Server Auth Guard', cat: 'Identity', keys: ['auth', 'session', 'user', 'patient'], env: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] },
  { id: 'unified-ai-client', name: 'Unified AI Client & Adapters', cat: 'AI / LLM', keys: ['ai', 'llm', 'diagnosis', 'summary', 'openai', 'gemini'], env: ['OPENAI_API_KEY', 'GEMINI_API_KEY'] },
  { id: 'agent-orchestrator', name: 'AI Planner & Improvement Loop', cat: 'Agents', keys: ['agent', 'workflow', 'autonomous', 'triage'], env: [] },
  { id: 'rag-toolkit', name: 'RAG & Document Intelligence', cat: 'AI / RAG', keys: ['rag', 'retrieval', 'knowledge', 'guidelines'], env: ['OPENAI_API_KEY'] },
  { id: 'speech-toolkit', name: 'Speech & Voice Toolkit', cat: 'Voice / Audio', keys: ['voice', 'speech', 'audio', 'talk', 'transcription'], env: ['OPENAI_API_KEY'] },
  { id: 'vision-toolkit', name: 'OCR & Multimodal Vision', cat: 'AI / Vision', keys: ['vision', 'image', 'ocr', 'scan', 'camera'], env: ['OPENAI_API_KEY'] },
  { id: 'database-storage-cache', name: 'Database, Storage & Caching', cat: 'Data / Persistence', keys: ['data', 'record', 'storage', 'database'], env: ['DATABASE_URL'] },
  { id: 'maps-geospatial', name: 'Maps & Geolocation', cat: 'Geospatial / UI', keys: ['map', 'location', 'gps', 'clinic', 'hospital'], env: ['NEXT_PUBLIC_MAPBOX_TOKEN'] },
  { id: 'payments-webhooks', name: 'Payments & Webhooks', cat: 'Payments / Webhooks', keys: ['payment', 'stripe', 'billing'], env: ['STRIPE_SECRET_KEY'] },
  { id: 'notifications-messaging', name: 'Notifications & Alerts', cat: 'Messaging / Alerts', keys: ['alert', 'notification', 'email', 'sms'], env: ['RESEND_API_KEY'] },
  { id: 'pwa-offline', name: 'PWA & Offline Support', cat: 'Offline / PWA', keys: ['offline', 'pwa', 'sync', 'rural'], env: [] },
  { id: 'forms-validation', name: 'Forms & Multi-Step Validation', cat: 'Forms / Validation', keys: ['form', 'intake', 'wizard', 'input'], env: [] },
  { id: 'ai-evaluation', name: 'AI Evaluation & Benchmarking', cat: 'AI / Benchmarks', keys: ['eval', 'benchmark', 'accuracy'], env: [] },
  { id: 'deployment-release', name: 'Deployment & Release Toolkit', cat: 'DevOps / Release', keys: ['deploy', 'release', 'docker'], env: [] }
]

const text = `${title} ${description}`.toLowerCase()

// Match capabilities
const selected = []
const unneeded = []

for (const cap of CAPABILITIES) {
  const isBaseline = ['safe-redirects', 'api-client-resilience', 'structured-logger', 'api-response', 'health-probes', 'security-headers', 'sanitization', 'deployment-release'].includes(cap.id)
  const matchesKeyword = cap.keys.some(k => text.includes(k))
  
  if (isBaseline || matchesKeyword) {
    selected.push(cap)
  } else {
    unneeded.push(cap.id)
  }
}

// Check environment variables
const requiredEnv = Array.from(new Set(selected.flatMap(c => c.env)))
const missingEnv = requiredEnv.filter(k => {
  const val = process.env[k]
  return !val || val.includes('placeholder') || val.includes('your_')
})

console.log(`\n✅ Matched ${selected.length} capabilities for this problem:`)
selected.forEach(c => console.log(`   - [${c.cat}] ${c.name}`))

console.log(`\n📦 Excluded ${unneeded.length} unneeded modules to prevent bloat.`)

if (missingEnv.length > 0) {
  console.log(`\n⚠️  Missing or placeholder credentials (${missingEnv.length}):`)
  missingEnv.forEach(k => console.log(`   - ${k} (Using zero-crash offline mock fallback)`))
} else {
  console.log('\n🔒 All matched credentials are ready or using safe local defaults.')
}

// Build HACKATHON-PLAN.md
const planLines = [
  `# Hackathon Project Plan: ${title}`,
  '',
  `**Generated:** ${new Date().toISOString()}`,
  `**Description:** ${description}`,
  '',
  '> Skeleton-First Principle: The starter serves the future product. Keep only what proves the product.',
  '',
  '## 1. Selected Capabilities',
  '',
  '| Capability | Domain | Action | Note |',
  '| :--- | :--- | :---: | :--- |'
]

selected.forEach(c => {
  planLines.push(`| **${c.name}** | ${c.cat} | \`KEEP\` | Ready in starter codebase |`)
})

planLines.push('')
planLines.push('## 2. Environment Status')
planLines.push('')
if (missingEnv.length === 0) {
  planLines.push('✅ No missing credentials detected.')
} else {
  missingEnv.forEach(k => planLines.push(`- ⚠️ \`${k}\`: Unset (offline mocks will run deterministically).`))
}

planLines.push('')
planLines.push('## 3. Prioritized Milestones')
planLines.push('')
planLines.push('1. [P1] **Baseline Check**: Verify environment and test suite health (`npm test`).')
planLines.push('2. [P1] **Domain Models**: Define data schemas in `src/types/` and Zod validations.')
planLines.push('3. [P2] **Core Engine / API**: Wire services with fallback offline mock support.')
planLines.push('4. [P2] **UI Integration**: Build user screens using AppShell and starter UI primitives.')
planLines.push('5. [P3] **End-to-End Verification**: Write integration test exercising user demo journey.')
planLines.push('6. [P4] **Pre-Flight Release Check**: Run `npm run release:check` and verify health probe.')
planLines.push('')
planLines.push('## 4. Verification Commands')
planLines.push('- Unit tests: `npm test`')
planLines.push('- Typecheck:  `npm run typecheck`')
planLines.push('- Build check: `npm run build`')
planLines.push('- Smoke probe: `npm run smoke`')
planLines.push('- Master gate: `npm run verify`')
planLines.push('')

const planPath = path.join(process.cwd(), 'HACKATHON-PLAN.md')
fs.writeFileSync(planPath, planLines.join('\n'), 'utf8')
console.log(`\n📄 Generated project plan: ${planPath}`)

if (runCheck) {
  console.log('\n🔍 Running baseline quality check...')
  const checkResult = spawnSync('npm', ['test'], { stdio: 'inherit', shell: true })
  if (checkResult.status === 0) {
    console.log('✅ Baseline tests passed!')
  } else {
    console.log('❌ Baseline tests failed. Resolve before starting new features.')
    process.exit(1)
  }
}

console.log('\n✨ Initialization complete. Ready to build!')
