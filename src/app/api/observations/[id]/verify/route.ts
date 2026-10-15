/**
 * src/app/api/observations/[id]/verify/route.ts
 * PATCH /api/observations/[id]/verify — Authorized verification and moderation endpoint
 */

import { NextRequest } from 'next/server'
import { apiError, apiSuccess, handleApiCatch } from '@/lib/api/response'
import { observationService, sanitizePublicObservation } from '@/lib/observations/service'
import { verifyObservationSchema } from '@/lib/validations/observation'
import { logger } from '@/lib/logging/logger'
import { timingSafeCompare } from '@/lib/security/crypto'

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    if (!id || typeof id !== 'string') {
      return apiError('Missing or invalid observation ID', {
        status: 400,
        code: 'INVALID_ID',
      })
    }

    // Authorization check
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim()

    const isProduction = process.env.NODE_ENV === 'production'
    const adminSecret = process.env.OBSERVATION_MODERATOR_KEY

    // In production, strictly require configured OBSERVATION_MODERATOR_KEY
    let isAuthorized = false
    if (adminSecret && token && timingSafeCompare(token, adminSecret)) {
      isAuthorized = true
    } else if (!isProduction) {
      // Allow development and automated test tokens in non-production environments only
      isAuthorized = Boolean(
        token && (token === 'dev-reviewer' || token === 'test-moderator-token')
      )
    }

    if (!isAuthorized) {
      logger.warn('Unauthorized attempt to verify observation', {
        observationId: id,
        hasToken: Boolean(token),
        isProduction,
      })
      return apiError('Unauthorized: Authorized reviewer token required for observation verification.', {
        status: 401,
        code: 'UNAUTHORIZED_VERIFICATION',
      })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return apiError('Malformed JSON payload', {
        status: 400,
        code: 'MALFORMED_JSON',
      })
    }

    const parsed = verifyObservationSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Validation error on verification payload', {
        status: 400,
        code: 'VALIDATION_ERROR',
        details: parsed.error.format(),
      })
    }

    const result = observationService.verifyObservation(id, parsed.data)
    if (result.error) {
      return apiError(result.error, {
        status: 404,
        code: 'OBSERVATION_NOT_FOUND',
      })
    }

    if (result.observation) {
      logger.info('Observation lifecycle status updated by moderator', {
        observationId: id,
        newStatus: result.observation.lifecycleStatus,
        verifiedBy: parsed.data.verifiedBy,
        verificationMethod: parsed.data.verificationMethod,
      })
      return apiSuccess(sanitizePublicObservation(result.observation))
    }
    return apiSuccess(null)
  } catch (err: unknown) {
    return handleApiCatch(err, 'Internal error processing verification', {
      code: 'VERIFICATION_ERROR',
      details: err instanceof Error ? err.message : String(err),
    })
  }
}
