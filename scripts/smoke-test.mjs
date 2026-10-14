#!/usr/bin/env node

/**
 * Post-Deployment Smoke Test CLI
 * 
 * Usage:
 *   node scripts/smoke-test.mjs [targetUrl]
 * 
 * Example:
 *   node scripts/smoke-test.mjs http://localhost:3000
 *   node scripts/smoke-test.mjs https://my-app.vercel.app
 */

const targetUrl = process.argv[2] || process.env.APP_URL || 'http://localhost:3000'
const normalizedBase = targetUrl.replace(/\/+$/, '')

console.log('='.repeat(65))
console.log('Post-Deployment Smoke Test Suite')
console.log(`Target: ${normalizedBase}`)
console.log('='.repeat(65))

const probes = [
  {
    name: 'API Health Probe',
    path: '/api/health',
    expectedStatus: 200,
    validate: (res, json) => {
      const isHealthy = json?.data?.status === 'healthy' || json?.status === 'healthy'
      return isHealthy ? { ok: true, msg: `uptime ${json?.data?.uptimeSeconds ?? 0}s` } : { ok: false, msg: 'status is not healthy' }
    },
  },
  {
    name: 'Public Landing Page',
    path: '/',
    expectedStatus: 200,
    validate: (res) => {
      const ct = res.headers.get('content-type') || ''
      return ct.includes('text/html')
        ? { ok: true, msg: 'valid HTML document rendered' }
        : { ok: false, msg: `unexpected content-type: ${ct}` }
    },
  },
  {
    name: 'Security Headers',
    path: '/',
    expectedStatus: 200,
    validate: (res) => {
      const frameOptions = res.headers.get('x-frame-options')
      const contentTypeOptions = res.headers.get('x-content-type-options')
      const hasSecurity = Boolean(frameOptions || contentTypeOptions)
      return hasSecurity
        ? { ok: true, msg: 'HTTP defense-in-depth headers present' }
        : { ok: false, msg: 'Missing standard security headers' }
    },
  },
  {
    name: '404 Route Isolation',
    path: '/_nonexistent_smoke_test_route_404',
    expectedStatus: 404,
    validate: (res, text) => {
      const leaksStack = text.includes('at process.runticks') || text.includes('node_modules')
      return !leaksStack
        ? { ok: true, msg: 'isolated 404 response without stack trace leaks' }
        : { ok: false, msg: 'leaked internal Node.js stack trace' }
    },
  },
]

let passed = 0
let failed = 0

for (const probe of probes) {
  const url = `${normalizedBase}${probe.path}`
  const start = Date.now()
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'HackathonStarter-SmokeTest/1.0' },
    })
    const duration = Date.now() - start
    const isJson = (res.headers.get('content-type') || '').includes('application/json')
    const body = isJson ? await res.json() : await res.text()

    if (res.status !== probe.expectedStatus) {
      console.log(` ❌ FAIL  ${probe.name.padEnd(25)} (${duration}ms) - Expected HTTP ${probe.expectedStatus}, got ${res.status}`)
      failed++
      continue
    }

    const check = probe.validate(res, body)
    if (check.ok) {
      console.log(` ✔ PASS  ${probe.name.padEnd(25)} (${duration}ms) - ${check.msg}`)
      passed++
    } else {
      console.log(` ❌ FAIL  ${probe.name.padEnd(25)} (${duration}ms) - ${check.msg}`)
      failed++
    }
  } catch (err) {
    const duration = Date.now() - start
    console.log(` ❌ FAIL  ${probe.name.padEnd(25)} (${duration}ms) - Request error: ${err.message}`)
    failed++
  }
}

console.log('-'.repeat(65))
console.log(`Summary: ${passed} passed, ${failed} failed (${probes.length} total)`)
console.log('='.repeat(65))

if (failed > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
