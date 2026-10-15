/**
 * src/app/api/alerts/subscribe/route.ts
 * POST /api/alerts/subscribe — Registers subscriber alert preferences and explicit opt-in consent.
 */

import { NextRequest } from 'next/server'
import crypto from 'node:crypto'
import { apiError, apiSuccess, handleApiCatch } from '@/lib/api/response'
import { isCitySupported } from '@/lib/city/registry'
import { getAlertRepository } from '@/lib/alerts/repository'
import { validateGeofenceTarget } from '@/lib/alerts/geofence'
import { subscribeRequestSchema } from '@/lib/validations/alerts'
import type { SubscriberPreference } from '@/lib/alerts/types'

function maskDestination(dest: string, channel: string): string {
  if (channel === 'email') {
    const parts = dest.split('@')
    if (parts.length === 2) {
      const name = parts[0]
      const domain = parts[1]
      return `${name[0]}***@${domain}`
    }
  } else if (channel === 'sms') {
    if (dest.length > 4) {
      return dest.slice(0, 3) + '*****' + dest.slice(-2)
    }
  } else if (channel === 'webhook') {
    try {
      const u = new URL(dest)
      return `${u.protocol}//${u.host}/***`
    } catch {
      return 'https://***'
    }
  }
  return '***'
}

export async function POST(req: NextRequest) {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return apiError('Malformed JSON payload', { status: 400, code: 'MALFORMED_JSON' })
    }

    const parsed = subscribeRequestSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Invalid subscriber registration payload', {
        status: 400,
        code: 'VALIDATION_ERROR',
        details: parsed.error.format(),
      })
    }

    const data = parsed.data
    const cityId = data.cityId.toLowerCase()
    if (!isCitySupported(cityId)) {
      return apiError(`Unsupported city '${cityId}'. Supported cities: amritsar`, {
        status: 400,
        code: 'UNKNOWN_CITY',
      })
    }

    // Validate geofence boundaries
    const geofenceCheck = validateGeofenceTarget(data.geofence, cityId)
    if (!geofenceCheck.valid) {
      return apiError(`Invalid geofence specification: ${geofenceCheck.error}`, {
        status: 400,
        code: 'INVALID_GEOFENCE',
      })
    }

    const repository = getAlertRepository()
    const subscriberId = `SUB-${cityId.toUpperCase()}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
    const now = new Date().toISOString()

    const subscriber: SubscriberPreference = {
      id: subscriberId,
      cityId,
      channel: data.channel,
      destination: data.destination,
      sensitivity: data.sensitivity,
      geofence: data.geofence,
      quietHours: data.quietHours,
      isOptedIn: true,
      isVerified: data.isTestSubscriber, // Test subscribers are pre-verified
      isTestSubscriber: data.isTestSubscriber,
      consentTimestamp: now,
      createdAt: now,
      updatedAt: now,
    }

    await repository.saveSubscriber(subscriber)

    return apiSuccess({
      subscriberId,
      cityId,
      channel: data.channel,
      maskedDestination: maskDestination(data.destination, data.channel),
      sensitivity: data.sensitivity,
      geofence: data.geofence,
      isOptedIn: true,
      consentTimestamp: now,
      note: 'Alert preferences saved. An alert represents modeled elevated risk, never a confirmed flood report.',
    })
  } catch (err) {
    return handleApiCatch(err, 'Failed to save subscriber preferences', {
      code: 'SUBSCRIPTION_ERROR',
      details: err instanceof Error ? err.message : String(err),
    })
  }
}
