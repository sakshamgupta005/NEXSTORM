/**
 * Container & Deployment Infrastructure Validator
 * 
 * Verifies Dockerfile, Docker Compose, and platform blueprints against best practices:
 * - Multi-stage build layers to minimize production image footprint
 * - Non-root container execution (USER nextjs UID 1001)
 * - Container health check instruction (HEALTHCHECK)
 * - Zero baked-in credentials in static Docker ENV statements
 */

import type { ContainerValidationResult } from './types'

export function validateDockerfileContent(content: string): ContainerValidationResult {
  const lines = content.split('\n')
  const warnings: string[] = []
  const errors: string[] = []

  let fromStages = 0
  let hasNonRootUser = false
  let hasHealthCheck = false
  const exposedPorts: number[] = []

  const SENSITIVE_ENV_KEYS = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'STRIPE_SECRET_KEY',
    'DATABASE_URL',
    'PASSWORD',
  ]

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim()
    if (!rawLine || rawLine.startsWith('#')) continue

    // Detect multi-stage FROM statements
    if (/^FROM\s+/i.test(rawLine)) {
      fromStages++
      if (!/alpine/i.test(rawLine)) {
        warnings.push(`Line ${i + 1}: Base image does not specify minimal alpine variant.`)
      }
    }

    // Detect USER instruction
    if (/^USER\s+(?!root\b)[a-zA-Z0-9_-]+/i.test(rawLine)) {
      hasNonRootUser = true
    }

    // Detect HEALTHCHECK
    if (/^HEALTHCHECK\s+/i.test(rawLine)) {
      hasHealthCheck = true
    }

    // Detect EXPOSE
    const exposeMatch = rawLine.match(/^EXPOSE\s+(\d+)/i)
    if (exposeMatch) {
      exposedPorts.push(parseInt(exposeMatch[1], 10))
    }

    // Detect static secret baking in ENV
    for (const key of SENSITIVE_ENV_KEYS) {
      const envPattern = new RegExp(`^ENV\\s+${key}\\s*=\\s*[^\\s$]`, 'i')
      if (envPattern.test(rawLine)) {
        errors.push(`Line ${i + 1}: Sensitive secret ${key} statically baked into Dockerfile image layer!`)
      }
    }
  }

  const hasMultiStage = fromStages >= 2
  if (!hasMultiStage) {
    warnings.push('Dockerfile does not use multi-stage build. Final image will include devDependencies.')
  }

  if (!hasNonRootUser) {
    warnings.push('Dockerfile lacks non-root USER instruction. Container will execute with root privileges.')
  }

  if (!hasHealthCheck) {
    warnings.push('Dockerfile lacks HEALTHCHECK instruction for container orchestrator readiness.')
  }

  if (exposedPorts.length === 0) {
    warnings.push('Dockerfile does not declare EXPOSE port (default port 3000 expected).')
  }

  const valid = errors.length === 0

  return {
    valid,
    hasMultiStage,
    hasNonRootUser,
    hasHealthCheck,
    exposedPorts,
    warnings,
    errors,
  }
}

export function validateDockerComposeContent(content: string): {
  valid: boolean
  hasHealthCheck: boolean
  hasPortMapping: boolean
  services: string[]
  warnings: string[]
} {
  const warnings: string[] = []
  const hasHealthCheck = /healthcheck:/i.test(content)
  const hasPortMapping = /ports:/i.test(content)

  const serviceMatches = content.match(/^\s{2}([a-zA-Z0-9_-]+):/gm) || []
  const services = serviceMatches.map((s) => s.trim().replace(':', ''))

  if (!hasPortMapping) {
    warnings.push('docker-compose does not map ports to host.')
  }

  return {
    valid: services.length > 0,
    hasHealthCheck,
    hasPortMapping,
    services,
    warnings,
  }
}
