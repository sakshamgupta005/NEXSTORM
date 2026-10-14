#!/usr/bin/env node
import { spawn } from 'node:child_process'
import process from 'node:process'

/**
 * Hackathon Starter — Reusable Quality Automation & Verification Runner
 * 
 * Executes quality gates sequentially and prints a concise, scannable summary table.
 * Returns exit code 0 if all steps succeed, or exit code 1 if any gate fails.
 * 
 * Usage:
 *   node scripts/verify.mjs            # Standard gates (env, lint, typecheck, test, build)
 *   node scripts/verify.mjs --e2e      # Includes Playwright browser smoke tests
 *   node scripts/verify.mjs --quick    # Skips production build for rapid iteration
 */

const args = process.argv.slice(2)
const includeE2E = args.includes('--e2e') || args.includes('--all')
const isQuick = args.includes('--quick')

const STEPS = [
  {
    name: 'Environment Diagnostic',
    command: 'node',
    args: ['scripts/check-env.mjs'],
    required: true,
  },
  {
    name: 'ESLint Rules',
    command: 'npm',
    args: ['run', 'lint'],
    required: true,
  },
  {
    name: 'TypeScript Compiler',
    command: 'npm',
    args: ['run', 'typecheck'],
    required: true,
  },
  {
    name: 'Vitest Unit & Component Tests',
    command: 'npm',
    args: ['test'],
    required: true,
  },
  {
    name: 'Next.js Production Build',
    command: 'npm',
    args: ['run', 'build'],
    required: !isQuick,
    skipReason: isQuick ? 'Skipped (--quick flag)' : undefined,
  },
  {
    name: 'Playwright E2E Smoke Tests',
    command: 'npm',
    args: ['run', 'test:e2e'],
    required: includeE2E,
    skipReason: !includeE2E ? 'Skipped (pass --e2e to include)' : undefined,
  },
]

function runStep(step) {
  return new Promise((resolve) => {
    if (step.skipReason) {
      resolve({
        name: step.name,
        command: `${step.command} ${step.args.join(' ')}`,
        status: 'SKIPPED',
        durationMs: 0,
        reason: step.skipReason,
      })
      return
    }

    const start = Date.now()
    const fullCmdStr = `${step.command} ${step.args.join(' ')}`
    console.log(`\n\x1b[36m▶ Running ${step.name}...\x1b[0m (\x1b[90m${fullCmdStr}\x1b[0m)`)

    const isWin = process.platform === 'win32'
    const exe = isWin && step.command === 'npm' ? 'cmd.exe' : step.command
    const exeArgs = isWin && step.command === 'npm' ? ['/d', '/s', '/c', 'npm', ...step.args] : step.args

    const child = spawn(exe, exeArgs, {
      stdio: 'inherit',
      env: process.env,
    })

    child.on('close', (code) => {
      const durationMs = Date.now() - start
      resolve({
        name: step.name,
        command: fullCmdStr,
        status: code === 0 ? 'PASSED' : 'FAILED',
        durationMs,
        code,
      })
    })

    child.on('error', (err) => {
      const durationMs = Date.now() - start
      resolve({
        name: step.name,
        command: `${step.command} ${step.args.join(' ')}`,
        status: 'FAILED',
        durationMs,
        error: err.message,
      })
    })
  })
}

async function main() {
  console.log('\x1b[1m\x1b[34m============================================================\x1b[0m')
  console.log('\x1b[1m  Hackathon Starter — Automated Quality Verification Gates   \x1b[0m')
  console.log('\x1b[1m\x1b[34m============================================================\x1b[0m')

  const results = []
  const overallStart = Date.now()
  let hasFailure = false

  for (const step of STEPS) {
    const result = await runStep(step)
    results.push(result)

    if (result.status === 'FAILED') {
      hasFailure = true
      console.error(`\x1b[31m✖ ${step.name} failed with code ${result.code || 1}\x1b[0m`)
      // Fail fast if required step fails
      break
    }
  }

  const totalDuration = ((Date.now() - overallStart) / 1000).toFixed(2)

  // Summary Table
  console.log('\n\x1b[1m------------------------------------------------------------\x1b[0m')
  console.log('\x1b[1mQuality Verification Summary\x1b[0m')
  console.log('\x1b[1m------------------------------------------------------------\x1b[0m')

  for (const r of results) {
    let badge = '\x1b[32m✔ PASS\x1b[0m'
    if (r.status === 'FAILED') badge = '\x1b[31m✖ FAIL\x1b[0m'
    if (r.status === 'SKIPPED') badge = '\x1b[33m- SKIP\x1b[0m'

    const timeStr = r.durationMs > 0 ? `${(r.durationMs / 1000).toFixed(2)}s` : '-'
    const note = r.reason ? ` (\x1b[90m${r.reason}\x1b[0m)` : ''
    console.log(` ${badge}  \x1b[1m${r.name.padEnd(32)}\x1b[0m ${timeStr.padStart(8)}${note}`)
  }

  console.log('------------------------------------------------------------')
  const passedCount = results.filter((r) => r.status === 'PASSED').length
  const failedCount = results.filter((r) => r.status === 'FAILED').length
  const skippedCount = STEPS.length - results.length + results.filter((r) => r.status === 'SKIPPED').length

  if (hasFailure) {
    console.log(`\x1b[31m\x1b[1mResult: FAILED\x1b[0m (${passedCount} passed, ${failedCount} failed, ${skippedCount} skipped in ${totalDuration}s)\n`)
    process.exit(1)
  } else {
    console.log(`\x1b[32m\x1b[1mResult: ALL CHECKS PASSED\x1b[0m (${passedCount} passed, ${skippedCount} skipped in ${totalDuration}s)\n`)
    process.exit(0)
  }
}

main().catch((err) => {
  console.error('Fatal verification runner error:', err)
  process.exit(1)
})
