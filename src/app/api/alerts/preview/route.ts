/**
 * src/app/api/alerts/preview/route.ts
 * POST /api/alerts/preview — Previews authoritative alert decision and message payload without dispatch.
 */

import { NextRequest } from 'next/server'
import { apiError, apiSuccess, handleApiCatch } from '@/lib/api/response'
import { isCitySupported } from '@/lib/city/registry'
import { evaluateAlertDecision, createScenarioRainfallSeries } from '@/lib/alerts/engine'
import { createAlertMessagePayload } from '@/lib/alerts/rollout'
import { fetchEnsembleForecast } from '@/lib/weather/ensemble'
import { previewAlertRequestSchema } from '@/lib/validations/alerts'
import type { RainfallSeries } from '@/lib/weather/types'

export async function POST(req: NextRequest) {
  try {
    let body: unknown = {}
    try {
      body = await req.json()
    } catch {
      // Allow empty body
    }

    const parsed = previewAlertRequestSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Validation error on preview request', {
        status: 400,
        code: 'VALIDATION_ERROR',
        details: parsed.error.format(),
      })
    }

    const { cityId, sensitivity, peakMm1h, durationH, antecedentMm72h } = parsed.data
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
      // Scenario mode preview
      series = createScenarioRainfallSeries({
        cityId,
        peakMm1h,
        durationH: durationH || 4,
        antecedentMm72h: antecedentMm72h || 0,
      })
    } else {
      // Live weather mode preview
      const weatherRes = await fetchEnsembleForecast({ cityId })
      if (!weatherRes.data) {
        isWeatherUnavailable = true
        weatherError = weatherRes.error || 'Live weather data unavailable'
      } else {
        series = weatherRes.data
      }
    }

    const decision = evaluateAlertDecision({
      cityId,
      sensitivity,
      series,
      isWeatherUnavailable,
      weatherError,
    })

    const samplePayload = createAlertMessagePayload(decision)

    return apiSuccess({
      decision,
      sampleMessagePayload: samplePayload,
      note: 'Alert preview only. No deliveries were queued or transmitted.',
    })
  } catch (err) {
    return handleApiCatch(err, 'Failed to generate alert preview', {
      code: 'PREVIEW_ERROR',
      details: err instanceof Error ? err.message : String(err),
    })
  }
}
