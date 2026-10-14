/**
 * Post-Deployment Smoke Test Suite
 * 
 * Verifies live application behavior post-deploy:
 * - /api/health liveness and readiness probe
 * - Landing page 200 OK and HTML response
 * - Security headers presence (anti-clickjacking, MIME sniffing prevention)
 * - 404 status code correctness and stack-trace leak prevention
 * - Web App Manifest availability
 */

import type {
  SmokeTestOptions,
  SmokeTestResult,
  SmokeTestSuiteReport,
} from './types'

export async function runSmokeTests(
  options: SmokeTestOptions
): Promise<SmokeTestSuiteReport> {
  const {
    baseUrl,
    timeoutMs = 8000,
    headers = {},
    fetchFn = fetch,
  } = options

  const normalizedBase = baseUrl.replace(/\/+$/, '')
  const startTime = Date.now()
  const results: SmokeTestResult[] = []

  // Helper fetch with timeout
  async function probe(
    name: string,
    endpoint: string,
    validator: (res: Response, text: string) => { passed: boolean; details?: string; error?: string }
  ): Promise<SmokeTestResult> {
    const url = `${normalizedBase}${endpoint}`
    const start = Date.now()

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      const response = await fetchFn(url, {
        headers: {
          'user-agent': 'HackathonStarter-SmokeTest/1.0',
          ...headers,
        },
        signal: controller.signal,
      })
      clearTimeout(timer)

      const durationMs = Date.now() - start
      const bodyText = await response.text()
      const validation = validator(response, bodyText)

      return {
        name,
        url,
        passed: validation.passed,
        statusCode: response.status,
        durationMs,
        details: validation.details,
        error: validation.error,
      }
    } catch (err) {
      const durationMs = Date.now() - start
      return {
        name,
        url,
        passed: false,
        statusCode: 0,
        durationMs,
        error: `Request failed: ${(err as Error).message}`,
      }
    }
  }

  // Probe 1: Health & Readiness Endpoint
  results.push(
    await probe('API Health Probe', '/api/health', (res, text) => {
      if (res.status !== 200) {
        return { passed: false, error: `Expected HTTP 200, got ${res.status}` }
      }
      try {
        const json = JSON.parse(text)
        const isHealthy = json?.data?.status === 'healthy' || json?.status === 'healthy'
        if (!isHealthy) {
          return { passed: false, error: 'Health endpoint response did not indicate status: "healthy"' }
        }
        return { passed: true, details: `Uptime: ${json?.data?.uptimeSeconds ?? 0}s, status: healthy` }
      } catch (err) {
        return { passed: false, error: `Invalid JSON returned by /api/health: ${(err as Error).message}` }
      }
    })
  )

  // Probe 2: Public Landing Page
  results.push(
    await probe('Public Landing Page', '/', (res, text) => {
      if (res.status !== 200) {
        return { passed: false, error: `Expected HTTP 200, got ${res.status}` }
      }
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('text/html')) {
        return { passed: false, error: `Expected text/html content-type, got "${contentType}"` }
      }
      if (text.length < 50) {
        return { passed: false, error: 'Landing page returned unusually short or empty HTML.' }
      }
      return { passed: true, details: `Rendered HTML payload (${text.length} bytes)` }
    })
  )

  // Probe 3: Security Headers Verification
  results.push(
    await probe('Security Headers', '/', (res) => {
      const frameOptions = res.headers.get('x-frame-options')
      const contentTypeOptions = res.headers.get('x-content-type-options')
      const referrerPolicy = res.headers.get('referrer-policy')
      const csp = res.headers.get('content-security-policy')

      const foundHeaders: string[] = []
      if (frameOptions) foundHeaders.push(`X-Frame-Options: ${frameOptions}`)
      if (contentTypeOptions) foundHeaders.push(`X-Content-Type-Options: ${contentTypeOptions}`)
      if (referrerPolicy) foundHeaders.push(`Referrer-Policy: ${referrerPolicy}`)
      if (csp) foundHeaders.push('Content-Security-Policy (configured)')

      const hasDefense = foundHeaders.length >= 2
      return {
        passed: hasDefense,
        details: hasDefense
          ? `Verified security headers: [${foundHeaders.join(', ')}]`
          : 'Missing standard HTTP defense-in-depth headers.',
      }
    })
  )

  // Probe 4: 404 Route Isolation & Stack Trace Leak Prevention
  results.push(
    await probe('404 Route Isolation', '/_unknown_probe_route_404', (res, text) => {
      if (res.status !== 404) {
        return { passed: false, error: `Expected HTTP 404 for unknown route, got ${res.status}` }
      }
      // Stack trace leak check
      const lower = text.toLowerCase()
      const leaksStackTrace =
        lower.includes('at process.runticks') ||
        lower.includes('node_modules') ||
        lower.includes('internal/process')

      if (leaksStackTrace) {
        return { passed: false, error: 'Error response leaked internal Node.js stack trace.' }
      }

      return { passed: true, details: 'Unknown route correctly yielded 404 without internal server leaks.' }
    })
  )

  // Probe 5: Web App Manifest
  results.push(
    await probe('PWA Manifest', '/manifest.webmanifest', (res, text) => {
      if (res.status !== 200) {
        return { passed: false, error: `Expected HTTP 200 for manifest, got ${res.status}` }
      }
      try {
        const json = JSON.parse(text)
        if (!json.name && !json.short_name) {
          return { passed: false, error: 'Manifest missing name or short_name property' }
        }
        return { passed: true, details: `Valid manifest for "${json.name || json.short_name}"` }
      } catch (err) {
        return { passed: false, error: `Malformed manifest JSON: ${(err as Error).message}` }
      }
    })
  )

  const passedCount = results.filter((r) => r.passed).length
  const failedCount = results.length - passedCount
  const overallPassed = failedCount === 0

  return {
    passed: overallPassed,
    total: results.length,
    passedCount,
    failedCount,
    durationMs: Date.now() - startTime,
    results,
    timestamp: new Date().toISOString(),
  }
}
