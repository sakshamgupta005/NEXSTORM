/**
 * src/app/api/observations/route.ts
 * GET /api/observations — Query verified and community waterlogging observations
 * POST /api/observations — Submit a new community waterlogging observation with rate-limiting and validation
 */

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api/response'
import { isCitySupported } from '@/lib/city/registry'
import { observationService } from '@/lib/observations/service'
import { rateLimiter } from '@/lib/security/rate-limit'
import {
  createObservationSchema,
  observationQuerySchema,
} from '@/lib/validations/observation'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const rawParams = {
      cityId: searchParams.get('cityId') || 'amritsar',
      status: searchParams.getAll('status').length > 1
        ? searchParams.getAll('status')
        : searchParams.get('status') || undefined,
      category: searchParams.get('category') || undefined,
      severity: searchParams.get('severity') || undefined,
      cellId: searchParams.get('cellId') || undefined,
      roadSegmentId: searchParams.get('roadSegmentId') || undefined,
      freshOnly: searchParams.get('freshOnly') || undefined,
      limit: searchParams.get('limit') || undefined,
    }

    const parsed = observationQuerySchema.safeParse(rawParams)
    if (!parsed.success) {
      return apiError('Invalid query parameters', {
        status: 400,
        code: 'INVALID_QUERY_PARAMS',
        details: parsed.error.format(),
      })
    }

    if (!isCitySupported(parsed.data.cityId)) {
      return apiError(`Unsupported city '${parsed.data.cityId}'`, {
        status: 400,
        code: 'UNSUPPORTED_CITY',
      })
    }

    const observations = observationService.queryObservations(parsed.data).map((obs) => {
      const publicObs = { ...obs }
      delete publicObs.reporterHash
      return publicObs
    })
    return apiSuccess({
      cityId: parsed.data.cityId,
      totalCount: observations.length,
      observations,
    })
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err.message.includes('bail out of prerendering') ||
        (err as { digest?: string }).digest?.startsWith('DYNAMIC_SERVER_USAGE'))
    ) {
      throw err
    }
    return apiError('Failed to query observations', {
      status: 500,
      code: 'OBSERVATIONS_FETCH_ERROR',
      details: err instanceof Error ? err.message : String(err),
    })
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. IP & Rate Limiting Check
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1'
    const userAgent = req.headers.get('user-agent') || ''

    // Rate limit: 5 submissions per 10 minutes per IP
    const rateCheck = rateLimiter.check(`obs_submit_${ip}`, {
      limit: 5,
      windowMs: 10 * 60 * 1000,
    })

    if (!rateCheck.success) {
      return apiError('Rate limit exceeded: Maximum 5 observations allowed per 10 minutes.', {
        status: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        headers: rateCheck.headers,
      })
    }

    // 2. Parse & Validate Payload
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return apiError('Malformed JSON payload', {
        status: 400,
        code: 'MALFORMED_JSON',
      })
    }

    const parsed = createObservationSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Validation error on observation submission', {
        status: 400,
        code: 'VALIDATION_ERROR',
        details: parsed.error.format(),
      })
    }

    const input = parsed.data
    if (!isCitySupported(input.cityId)) {
      return apiError(`Unsupported city '${input.cityId}'`, {
        status: 400,
        code: 'UNSUPPORTED_CITY',
      })
    }

    // 3. Generate Pseudonymous Reporter Hash (Zero PII stored)
    const reporterHash = observationService.generateReporterHash(ip, userAgent)

    // 4. Submit to Observation Service
    const result = observationService.submitObservation(input, reporterHash)

    if (result.duplicate) {
      return apiError(result.error || 'Duplicate submission detected', {
        status: 409,
        code: 'DUPLICATE_OBSERVATION',
      })
    }

    if (!result.observation) {
      return apiError(result.error || 'Failed to record observation', {
        status: 500,
        code: 'SUBMISSION_FAILED',
      })
    }

    const publicObservation = { ...result.observation }
    delete publicObservation.reporterHash
    return apiSuccess(publicObservation, {
      status: 201,
      headers: rateCheck.headers,
    })
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err.message.includes('bail out of prerendering') ||
        (err as { digest?: string }).digest?.startsWith('DYNAMIC_SERVER_USAGE'))
    ) {
      throw err
    }
    return apiError('Internal server error processing observation', {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      details: err instanceof Error ? err.message : String(err),
    })
  }
}
