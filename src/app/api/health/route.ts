/**
 * Health & Readiness Check Endpoint
 * 
 * Capabilities:
 * - Basic liveness probe (GET /api/health)
 * - Explicit probe query parameters: ?probe=liveness | ?probe=readiness
 * - Returns uptime, release identifiers, environment configuration readiness (without leaking secrets)
 * - Standardized JSON contract using apiSuccess
 */

import { NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api/response'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getSourceHealthSummary } from '@/lib/weather/source-tracker'

export async function GET(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? undefined
  const probe = request.nextUrl.searchParams.get('probe') || 'default'

  // Rapid liveness check: verify process is answering HTTP requests
  if (probe === 'liveness') {
    return apiSuccess(
      {
        status: 'healthy',
        probe: 'liveness',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        requestId,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      }
    )
  }

  const gitCommit =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.RENDER_GIT_COMMIT ||
    process.env.GITHUB_SHA ||
    process.env.GIT_COMMIT_SHA ||
    'local'

  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'

  const healthData = {
    status: 'healthy',
    probe,
    version: appVersion,
    commit: gitCommit.slice(0, 7),
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      supabaseConfigured: isSupabaseConfigured(),
      aiConfigured: Boolean(
        process.env.OPENAI_API_KEY ||
        process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
        process.env.GROQ_API_KEY
      ),
    },
    checks: {
      serverClock: true,
      runtimeUptime: true,
      memoryUsageMb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
    },
    sources: getSourceHealthSummary(),
  }

  return apiSuccess(healthData, {
    status: 200,
    requestId,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
