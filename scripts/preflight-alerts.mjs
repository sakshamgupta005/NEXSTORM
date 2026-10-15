#!/usr/bin/env node

/**
 * scripts/preflight-alerts.mjs
 * CLI runner for NEXSTORM P21 Alert Deployment Preflight Checks.
 * 
 * Usage:
 *   node scripts/preflight-alerts.mjs [--mode=evaluation_only|test_mode|limited_rollout|general_availability]
 */

const modeArg = process.argv.find((a) => a.startsWith('--mode='))
const targetMode = modeArg ? modeArg.split('=')[1] : (process.env.DISPATCH_ROLLOUT_MODE || 'evaluation_only')

console.log('='.repeat(70))
console.log('NEXSTORM Alert System — Production Deployment Preflight Check')
console.log(`Target Rollout Mode: ${targetMode}`)
console.log(`Kill Switch Status:  ${process.env.DISPATCH_KILL_SWITCH === 'true' ? 'ACTIVE (SUPPRESSED)' : 'Disengaged'}`)
console.log('='.repeat(70))

const checks = []

// 1. Rollout Mode
checks.push({
  name: 'Rollout Mode Governance',
  status: 'PASS',
  msg: `Target mode set to '${targetMode}' (default is 'evaluation_only')`,
})

// 2. Kill Switch
if (process.env.DISPATCH_KILL_SWITCH === 'true') {
  checks.push({
    name: 'Operator Kill Switch',
    status: 'WARN',
    msg: 'DISPATCH_KILL_SWITCH=true is engaged; all external dispatches are suppressed.',
  })
} else {
  checks.push({
    name: 'Operator Kill Switch',
    status: 'PASS',
    msg: 'DISPATCH_KILL_SWITCH is disengaged.',
  })
}

// 3. Operator Key (ALERT_OPERATOR_KEY)
const opKey = process.env.ALERT_OPERATOR_KEY
if (!opKey || opKey.length < 16) {
  if (targetMode === 'evaluation_only') {
    checks.push({
      name: 'Operator Secret (ALERT_OPERATOR_KEY)',
      status: 'WARN',
      msg: 'ALERT_OPERATOR_KEY is missing or < 16 chars; dispatch API requires token.',
    })
  } else {
    checks.push({
      name: 'Operator Secret (ALERT_OPERATOR_KEY)',
      status: 'FAIL',
      msg: 'ALERT_OPERATOR_KEY is missing or insufficient length (min 16 chars required).',
    })
  }
} else {
  checks.push({
    name: 'Operator Secret (ALERT_OPERATOR_KEY)',
    status: 'PASS',
    msg: `Configured with valid length (${opKey.length} chars). Value masked.`,
  })
}

// 4. Webhook Signing Secret (ALERT_WEBHOOK_SECRET)
const whSecret = process.env.ALERT_WEBHOOK_SECRET
if (!whSecret || whSecret.length < 16) {
  if (targetMode === 'evaluation_only') {
    checks.push({
      name: 'Webhook Secret (ALERT_WEBHOOK_SECRET)',
      status: 'WARN',
      msg: 'ALERT_WEBHOOK_SECRET is unconfigured; default fallback key active for dev/test.',
    })
  } else {
    checks.push({
      name: 'Webhook Secret (ALERT_WEBHOOK_SECRET)',
      status: 'FAIL',
      msg: 'ALERT_WEBHOOK_SECRET is missing or < 16 chars. Required for safe webhook signing.',
    })
  }
} else {
  checks.push({
    name: 'Webhook Secret (ALERT_WEBHOOK_SECRET)',
    status: 'PASS',
    msg: `Configured with valid length (${whSecret.length} chars). Value masked.`,
  })
}

// 5. Database Persistence
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const hasSupabase = Boolean(supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder'))

if (hasSupabase) {
  checks.push({
    name: 'Durable Database Persistence',
    status: 'PASS',
    msg: 'Supabase PostgreSQL configuration detected.',
  })
} else if (targetMode === 'limited_rollout' || targetMode === 'general_availability') {
  checks.push({
    name: 'Durable Database Persistence',
    status: 'FAIL',
    msg: 'Durable Supabase PostgreSQL required for limited rollout or GA (file storage is non-durable).',
  })
} else {
  checks.push({
    name: 'Durable Database Persistence',
    status: 'WARN',
    msg: 'Using local file storage. Data will not survive container restarts or multi-instance scaling.',
  })
}

// 6. City Readiness & Evidence Audit
import fs from 'node:fs'
import path from 'node:path'

const cityArg = process.argv.find((a) => a.startsWith('--city='))
const targetCity = cityArg ? cityArg.split('=')[1].toLowerCase() : null

const citiesDir = path.join(process.cwd(), 'public', 'data', 'cities')
const discoveredCities = fs.existsSync(citiesDir)
  ? fs
      .readdirSync(citiesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(citiesDir, d.name, 'city.config.json')))
      .map((d) => d.name.toLowerCase())
  : ['amritsar']

const citiesToCheck = targetCity ? [targetCity] : discoveredCities

for (const c of citiesToCheck) {
  const confPath = path.join(citiesDir, c, 'city.config.json')
  const invPath = path.join(citiesDir, c, 'incidents_inventory.json')
  const hasConf = fs.existsSync(confPath)
  const hasInv = fs.existsSync(invPath)

  if (!hasConf) {
    checks.push({
      name: `City Readiness Gate (${c})`,
      status: 'FAIL',
      msg: `city.config.json missing for city '${c}'.`,
    })
    continue
  }

  let incidentCount = 0
  if (hasInv) {
    try {
      const inv = JSON.parse(fs.readFileSync(invPath, 'utf-8'))
      incidentCount = Array.isArray(inv) ? inv.length : 0
    } catch {}
  }

  if (targetMode !== 'evaluation_only' && incidentCount < 5) {
    checks.push({
      name: `City Readiness Gate (${c})`,
      status: 'FAIL',
      msg: `City '${c}' has insufficient ground-truth evidence (${incidentCount} incidents); non-evaluation rollout blocked.`,
    })
  } else if (incidentCount < 5) {
    checks.push({
      name: `City Readiness Gate (${c})`,
      status: 'WARN',
      msg: `City '${c}' is in evidence_insufficient state; model outputs restricted to internal exploratory use.`,
    })
  } else {
    checks.push({
      name: `City Readiness Gate (${c})`,
      status: 'PASS',
      msg: `City '${c}' has verified ground-truth evidence (${incidentCount} verified locations).`,
    })
  }
}

// Print results
let fails = 0
let warns = 0
let passes = 0

for (const c of checks) {
  const badge = c.status === 'PASS' ? '[PASS]' : c.status === 'WARN' ? '[WARN]' : '[FAIL]'
  console.log(`${badge.padEnd(7)} ${c.name.padEnd(40)} ${c.msg}`)
  if (c.status === 'FAIL') fails++
  if (c.status === 'WARN') warns++
  if (c.status === 'PASS') passes++
}

console.log('-'.repeat(70))
console.log(`Results: ${passes} passed, ${warns} warnings, ${fails} failed.`)

if (fails > 0) {
  console.log('\n[PREFLIGHT RESULT]: BLOCKED. One or more mandatory checks failed for target mode.')
  process.exit(1)
} else {
  console.log('\n[PREFLIGHT RESULT]: READY. Preflight checks passed for target rollout mode.')
  process.exit(0)
}
