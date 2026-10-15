/**
 * src/app/api/alerts/unsubscribe/route.ts
 * POST /api/alerts/unsubscribe — Explicit subscriber opt-out and consent revocation.
 */

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api/response'
import { getAlertRepository } from '@/lib/alerts/repository'
import { unsubscribeRequestSchema } from '@/lib/validations/alerts'

export async function POST(req: NextRequest) {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return apiError('Malformed JSON payload', { status: 400, code: 'MALFORMED_JSON' })
    }

    const parsed = unsubscribeRequestSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Validation error', {
        status: 400,
        code: 'VALIDATION_ERROR',
        details: parsed.error.format(),
      })
    }

    const { subscriberId } = parsed.data
    const repository = getAlertRepository()
    const success = await repository.unsubscribe(subscriberId)

    if (!success) {
      return apiError(`Subscriber '${subscriberId}' not found or already unsubscribed`, {
        status: 404,
        code: 'SUBSCRIBER_NOT_FOUND',
      })
    }

    return apiSuccess({
      subscriberId,
      isOptedIn: false,
      unsubscribedAt: new Date().toISOString(),
      message: 'Successfully unsubscribed from NEXSTORM risk alerts.',
    })
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes('bail out of prerendering') ||
        (err as { digest?: string }).digest?.startsWith('DYNAMIC_SERVER_USAGE'))
    ) {
      throw err
    }
    return apiError('Failed to process unsubscribe request', {
      status: 500,
      code: 'UNSUBSCRIBE_ERROR',
      details: err instanceof Error ? err.message : String(err),
    })
  }
}
