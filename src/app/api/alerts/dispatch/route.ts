/**
 * src/app/api/alerts/dispatch/route.ts
 * POST /api/alerts/dispatch — Operator-controlled dispatch endpoint.
 * Protected by ALERT_OPERATOR_KEY; recomputes hazard decisions on the server.
 */

import { NextRequest } from 'next/server'
import { apiError, apiSuccess, handleApiCatch } from '@/lib/api/response'
import { isCitySupported } from '@/lib/city/registry'
import { runAlertDispatch } from '@/lib/alerts/dispatcher'
import { createScenarioRainfallSeries } from '@/lib/alerts/engine'
import { fetchEnsembleForecast } from '@/lib/weather/ensemble'
import { dispatchRequestSchema } from '@/lib/validations/alerts'
import { logger } from '@/lib/logging/logger'
import { timingSafeCompare } from '@/lib/security/crypto'
import type { RainfallSeries } from '@/lib/weather/types'

export async function POST(req: NextRequest) {
  try {
    // 1. Operator Authorization Check
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim()

    const isProduction = process.env.NODE_ENV === 'production'
    const operatorSecret = process.env.ALERT_OPERATOR_KEY

    let isAuthorized = false
    if (operatorSecret && token && timingSafeCompare(token, operatorSecret)) {
      isAuthorized = true
    } else if (!isProduction) {
      isAuthorized = Boolean(token && (token === 'dev-operator' || token === 'test-operator-token'))
    }

    if (!isAuthorized) {
      logger.warn('Unauthorized attempt to trigger alert dispatch', {
        hasToken: Boolean(token),
        isProduction,
      })
      return apiError('Unauthorized: Valid operator token required for alert dispatch.', {
        status: 401,
        code: 'UNAUTHORIZED_OPERATOR',
      })
    }

    let body: unknown = {}
    try {
      body = await req.json()
    } catch {
      // Allow empty body for default live dispatch
    }

    const parsed = dispatchRequestSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Validation error on dispatch request', {
        status: 400,
        code: 'VALIDATION_ERROR',
        details: parsed.error.format(),
      })
    }

    const { cityId, sensitivity, peakMm1h, durationH, antecedentMm72h, forceTestProvider } = parsed.data
    if (!isCitySupported(cityId)) {
      return apiError(`Unsupported city '${cityId}'. Supported cities: amritsar`, {
        status: 400,
        code: 'UNKNOWN_CITY',
      })
    }

    let series: RainfallSeries | undefined
    let isWeatherUnavailable = false
    let weatherError: string | undefined

    if (peakMm1h !== undefined && peakMm1h > 0) {
      // Scenario mode dispatch
      series = createScenarioRainfallSeries({
        cityId,
        peakMm1h,
        durationH: durationH || 4,
        antecedentMm72h: antecedentMm72h || 0,
      })
    } else {
      // Live weather mode dispatch
      const weatherRes = await fetchEnsembleForecast({ cityId })
      if (!weatherRes.data) {
        isWeatherUnavailable = true
        weatherError = weatherRes.error || 'Live weather data unavailable'
      } else {
        series = weatherRes.data
      }
    }

    // Run authoritative server-recomputed dispatch
    const summary = await runAlertDispatch({
      cityId,
      sensitivity,
      series,
      isWeatherUnavailable,
      weatherError,
      forceTestProvider,
    })

    logger.info('Alert dispatch cycle completed', {
      cityId,
      decisionState: summary.decision.state,
      rolloutMode: summary.rolloutMode,
      killSwitch: summary.killSwitchActive,
      queued: summary.queuedDeliveries,
      delivered: summary.successfulDeliveries,
      suppressed: summary.suppressedDeliveries,
    })

    return apiSuccess(summary)
  } catch (err) {
    return handleApiCatch(err, 'Internal error executing alert dispatch', {
      code: 'DISPATCH_ERROR',
      details: err instanceof Error ? err.message : String(err),
    })
  }
}
