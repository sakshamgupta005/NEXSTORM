/**
 * Deployment & Release Readiness Toolkit - Type Definitions
 * 
 * References:
 * - Docker Node.js Best Practices (https://github.com/docker/docs)
 * - Docker Compose Specification (https://github.com/docker/compose)
 * - GitHub Actions Core Guidelines (https://github.com/actions)
 * - Vercel & Render Deployment Conventions
 */

export type CheckStatus = 'pass' | 'warn' | 'fail'

export type CheckCategory =
  | 'environment'
  | 'security'
  | 'build'
  | 'health'
  | 'dependencies'
  | 'container'

export interface ReleaseCheckItem {
  id: string
  name: string
  category: CheckCategory
  status: CheckStatus
  message: string
  details?: string
  remediation?: string
}

export type OverallReleaseStatus = 'READY' | 'NEEDS_ATTENTION' | 'NOT_READY'

export interface ReleaseReadinessReport {
  status: OverallReleaseStatus
  summary: {
    total: number
    pass: number
    warn: number
    fail: number
  }
  checks: ReleaseCheckItem[]
  timestamp: string
  version: string
  target?: string
  metadata?: Record<string, unknown>
}

export interface SmokeTestOptions {
  baseUrl: string
  timeoutMs?: number
  headers?: Record<string, string>
  fetchFn?: typeof fetch
}

export interface SmokeTestResult {
  name: string
  url: string
  passed: boolean
  statusCode: number
  durationMs: number
  details?: string
  error?: string
}

export interface SmokeTestSuiteReport {
  passed: boolean
  total: number
  passedCount: number
  failedCount: number
  durationMs: number
  results: SmokeTestResult[]
  timestamp: string
}

export interface ContainerValidationResult {
  valid: boolean
  hasMultiStage: boolean
  hasNonRootUser: boolean
  hasHealthCheck: boolean
  exposedPorts: number[]
  warnings: string[]
  errors: string[]
}
