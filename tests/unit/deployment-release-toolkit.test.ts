import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/health/route'
import {
  evaluateReleaseReadiness,
  maskSecretValue,
  isPlaceholderCredential,
  runSmokeTests,
  validateDockerfileContent,
  validateDockerComposeContent,
} from '@/lib/release'
import fs from 'node:fs'
import path from 'node:path'

describe('Part 4.24 — Reusable Deployment & Release Toolkit', () => {
  describe('1. Secret Masking & Placeholder Credential Detection', () => {
    it('masks secret values without revealing true credentials', () => {
      expect(maskSecretValue('sk-1234567890abcdef')).toBe('sk-...def')
      expect(maskSecretValue('short')).toBe('****')
      expect(maskSecretValue('')).toBe('(empty)')
      expect(maskSecretValue(undefined)).toBe('(empty)')
    })

    it('identifies known placeholder credential patterns', () => {
      expect(isPlaceholderCredential('your-openai-api-key')).toBe(true)
      expect(isPlaceholderCredential('placeholder_secret')).toBe(true)
      expect(isPlaceholderCredential('change-me-later')).toBe(true)
      expect(isPlaceholderCredential('TODO_INSERT_KEY')).toBe(true)
      expect(isPlaceholderCredential('sk-proj-xxxxxx123')).toBe(true)
      expect(isPlaceholderCredential('sk-ant-xxxxxx123')).toBe(true)
      expect(isPlaceholderCredential('123')).toBe(true)

      // Genuine looking credentials
      expect(isPlaceholderCredential('sk-validRealLookingSecretToken1234567890')).toBe(false)
      expect(isPlaceholderCredential('sb_secret_prod_998877665544332211')).toBe(false)
    })
  })

  describe('2. Release Readiness Evaluator', () => {
    it('evaluates clean environment as READY', () => {
      const cleanEnv = {
        NODE_ENV: 'production',
        NEXT_PUBLIC_APP_VERSION: '1.0.0',
        OPENAI_API_KEY: 'sk-actualLiveApiKeySecret1234567890',
        NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_pub_1234567890abcdef',
      }

      const report = evaluateReleaseReadiness({ env: cleanEnv, isProduction: true })
      expect(report.status).toBe('READY')
      expect(report.summary.fail).toBe(0)
      expect(report.summary.pass).toBeGreaterThanOrEqual(4)
    })

    it('flags NOT_READY when dummy placeholders or client secret leaks exist', () => {
      const dirtyEnv = {
        NODE_ENV: 'production',
        OPENAI_API_KEY: 'your-openai-key-here', // Placeholder
        NEXT_PUBLIC_SERVICE_ROLE_KEY: 'supabase_secret_admin_key', // Client leak
      }

      const report = evaluateReleaseReadiness({ env: dirtyEnv, isProduction: true })
      expect(report.status).toBe('NOT_READY')
      expect(report.summary.fail).toBeGreaterThanOrEqual(2)

      const placeholderCheck = report.checks.find((c) => c.id.includes('placeholder-openai'))
      expect(placeholderCheck?.status).toBe('fail')
      expect(placeholderCheck?.message).toContain('placeholder value')

      const leakCheck = report.checks.find((c) => c.id === 'sec-public-prefix-leak')
      expect(leakCheck?.status).toBe('fail')
      expect(leakCheck?.message).toContain('NEXT_PUBLIC_')
    })

    it('warns when NODE_ENV is development during a production target check', () => {
      const devEnv = {
        NODE_ENV: 'development',
      }

      const report = evaluateReleaseReadiness({ env: devEnv, isProduction: true })
      expect(report.status).toBe('NEEDS_ATTENTION')
      const nodeCheck = report.checks.find((c) => c.id === 'env-node-env')
      expect(nodeCheck?.status).toBe('warn')
    })
  })

  describe('3. Post-Deployment Smoke Test Engine', () => {
    it('executes all probes successfully with a healthy mock server', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/health')) {
          return new Response(JSON.stringify({ status: 'healthy', data: { status: 'healthy', uptimeSeconds: 42 } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        }
        if (url.includes('/manifest.webmanifest')) {
          return new Response(JSON.stringify({ name: 'Hackathon Starter', short_name: 'Starter' }), {
            status: 200,
            headers: { 'content-type': 'application/manifest+json' },
          })
        }
        if (url.includes('_unknown_probe_route_404')) {
          return new Response('<html>404 Not Found</html>', {
            status: 404,
            headers: { 'content-type': 'text/html' },
          })
        }
        // Root page
        return new Response('<!DOCTYPE html><html><body><h1>Hackathon Starter</h1></body></html>', {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'x-frame-options': 'DENY',
            'x-content-type-options': 'nosniff',
          },
        })
      })

      const report = await runSmokeTests({
        baseUrl: 'http://localhost:3000',
        fetchFn: mockFetch as unknown as typeof fetch,
      })

      expect(report.passed).toBe(true)
      expect(report.total).toBe(5)
      expect(report.passedCount).toBe(5)
      expect(report.failedCount).toBe(0)
    })

    it('reports failure when health probe returns unhealthy or error status', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/health')) {
          return new Response(JSON.stringify({ status: 'unhealthy', error: 'Database unreachable' }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
          })
        }
        return new Response('ok', { status: 200, headers: { 'content-type': 'text/html' } })
      })

      const report = await runSmokeTests({
        baseUrl: 'http://localhost:3000',
        fetchFn: mockFetch as unknown as typeof fetch,
      })

      expect(report.passed).toBe(false)
      const healthResult = report.results.find((r) => r.name === 'API Health Probe')
      expect(healthResult?.passed).toBe(false)
      expect(healthResult?.statusCode).toBe(500)
    })

    it('detects stack trace leaks in 404 responses', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('_unknown_probe_route_404')) {
          return new Response('Error: fail at process.runTicks (node_modules/next/dist/server.js:12)', {
            status: 404,
            headers: { 'content-type': 'text/plain' },
          })
        }
        return new Response('ok', {
          status: 200,
          headers: {
            'content-type': 'text/html',
            'x-frame-options': 'DENY',
            'x-content-type-options': 'nosniff',
          },
        })
      })

      const report = await runSmokeTests({
        baseUrl: 'http://localhost:3000',
        fetchFn: mockFetch as unknown as typeof fetch,
      })

      expect(report.passed).toBe(false)
      const notFoundResult = report.results.find((r) => r.name === '404 Route Isolation')
      expect(notFoundResult?.passed).toBe(false)
      expect(notFoundResult?.error).toContain('stack trace')
    })
  })

  describe('4. Container & Docker Configuration Best Practices', () => {
    it('validates the repository Dockerfile against production best practices', () => {
      const dockerfilePath = path.join(process.cwd(), 'Dockerfile')
      expect(fs.existsSync(dockerfilePath)).toBe(true)

      const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf-8')
      const validation = validateDockerfileContent(dockerfileContent)

      expect(validation.valid).toBe(true)
      expect(validation.hasMultiStage).toBe(true)
      expect(validation.hasNonRootUser).toBe(true)
      expect(validation.hasHealthCheck).toBe(true)
      expect(validation.exposedPorts).toContain(3000)
      expect(validation.errors.length).toBe(0)
    })

    it('catches dangerous static secret injection in Dockerfile', () => {
      const dangerousDockerfile = `
        FROM node:22-alpine
        ENV OPENAI_API_KEY=sk-hardcoded-api-key-never-do-this
        CMD ["node", "server.js"]
      `
      const validation = validateDockerfileContent(dangerousDockerfile)
      expect(validation.valid).toBe(false)
      expect(validation.errors.some((e) => e.includes('OPENAI_API_KEY'))).toBe(true)
    })

    it('validates the repository docker-compose.yml configuration', () => {
      const composePath = path.join(process.cwd(), 'docker-compose.yml')
      expect(fs.existsSync(composePath)).toBe(true)

      const composeContent = fs.readFileSync(composePath, 'utf-8')
      const validation = validateDockerComposeContent(composeContent)

      expect(validation.valid).toBe(true)
      expect(validation.hasPortMapping).toBe(true)
      expect(validation.hasHealthCheck).toBe(true)
      expect(validation.services).toContain('web')
    })
  })

  describe('5. Health Endpoint Probe Features', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('supports rapid liveness probe (?probe=liveness)', async () => {
      const req = new NextRequest('http://localhost:3000/api/health?probe=liveness')
      const res = await GET(req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.status).toBe('healthy')
      expect(body.data.probe).toBe('liveness')
      expect(body.data.uptimeSeconds).toBeGreaterThanOrEqual(0)
    })

    it('supports comprehensive readiness probe with memory and environment data', async () => {
      const req = new NextRequest('http://localhost:3000/api/health?probe=readiness', {
        headers: { 'x-request-id': 'readiness_probe_req_999' },
      })
      const res = await GET(req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.requestId).toBe('readiness_probe_req_999')
      expect(body.data.status).toBe('healthy')
      expect(body.data.probe).toBe('readiness')
      expect(body.data.version).toBeDefined()
      expect(body.data.commit).toBeDefined()
      expect(body.data.checks.memoryUsageMb).toBeGreaterThanOrEqual(1)
    })
  })
})
