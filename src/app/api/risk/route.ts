/**
 * GET /api/risk
 * 
 * Supports:
 * - Live forecast mode: /api/risk?cityId=amritsar&mode=live&t=3
 * - Historical replay mode: /api/risk?cityId=amritsar&mode=replay&event=2025-09-01_amritsar&t=1
 * - Scenario simulation mode: /api/risk?cityId=amritsar&mode=scenario&peakMm1h=40&durationH=4&antecedentMm72h=20
 */

import fs from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api/response'
import { getCityConfig, getCitySusceptibility, isCitySupported } from '@/lib/city/registry'
import {
  createDerivedRiskProvenance,
  createDerivedSusceptibilityProvenance,
  createSimulatedRainfallProvenance,
  PERMANENT_DISCLAIMER,
} from '@/lib/provenance'
import { computeRiskGrid, computeTimeline } from '@/lib/risk/engine'
import { rollingSum } from '@/lib/risk/rti'
import { generateTriangularHyetograph, ScenarioInputSchema } from '@/lib/risk/scenario'
import type { Provenance } from '@/lib/risk/types'
import { fetchEnsembleForecast } from '@/lib/weather/ensemble'
import type { RainfallSeries } from '@/lib/weather/types'

export async function GET(req: NextRequest) {


  try {
    const { searchParams } = new URL(req.url)
    const rawMode = searchParams.get('mode')
    const rawPeak = searchParams.get('peakMm1h')
    const cityId = (searchParams.get('cityId') || 'amritsar').toLowerCase()

    // Infer mode if not explicitly supplied
    let mode: 'live' | 'replay' | 'scenario'
    if (rawMode) {
      const m = rawMode.toLowerCase()
      if (m !== 'live' && m !== 'replay' && m !== 'scenario') {
        return apiError(
          `Invalid mode '${rawMode}'. Supported modes: 'live', 'replay', 'scenario'.`,
          {
            status: 400,
            code: 'INVALID_MODE',
          }
        )
      }
      mode = m as 'live' | 'replay' | 'scenario'
    } else if (rawPeak !== null) {
      mode = 'scenario'
    } else {
      mode = 'live'
    }

    if (!isCitySupported(cityId)) {
      return apiError(`Unknown city '${cityId}'. Supported cities: amritsar`, {
        status: 400,
        code: 'UNKNOWN_CITY',
      })
    }

    let config
    let susceptibility
    try {
      config = getCityConfig(cityId)
      susceptibility = getCitySusceptibility(cityId)
    } catch (err: unknown) {
      return apiError(
        `Configuration or susceptibility validation failed: ${err instanceof Error ? err.message : String(err)}`,
        {
          status: 500,
          code: 'CONFIG_VALIDATION_FAILED',
        }
      )
    }

    let series: RainfallSeries
    let adapterStatus: 'ok' | 'degraded' = 'ok'
    let antecedentMm72h = 0

    // 1. LIVE MODE
    if (mode === 'live') {
      const adapterResult = await fetchEnsembleForecast({ cityId })
      if (!adapterResult.data) {
        return apiError(
          `Rainfall data provider is unavailable and no cached snapshot exists: ${adapterResult.error || 'degraded upstream'}`,
          {
            status: 503,
            code: 'DEGRADED_NO_SNAPSHOT',
            details: {
              status: 'degraded',
              disclaimer: PERMANENT_DISCLAIMER,
              provenance: [adapterResult.provenance],
              error: adapterResult.error,
            },
          }
        )
      }

      series = adapterResult.data
      if (adapterResult.status === 'degraded') {
        adapterStatus = 'degraded'
      }
    }
    // 2. REPLAY MODE
    else if (mode === 'replay') {
      const rawEvent = searchParams.get('event') || '2025-09-01_amritsar'
      const sanitizedEvent = rawEvent.replace(/\.json$/i, '').trim()

      if (!/^[a-zA-Z0-9_-]+$/.test(sanitizedEvent)) {
        return apiError(
          `Invalid event parameter '${rawEvent}'. Must be alphanumeric identifier without path traversal.`,
          {
            status: 400,
            code: 'INVALID_EVENT_PARAM',
          }
        )
      }

      const replayPath = path.resolve(
        process.cwd(),
        'public',
        'data',
        'replay',
        `${sanitizedEvent}.json`
      )

      if (!fs.existsSync(replayPath)) {
        return apiError(`Replay event '${sanitizedEvent}' not found.`, {
          status: 404,
          code: 'REPLAY_EVENT_NOT_FOUND',
        })
      }

      let replayData: {
        id: string
        cityId: string
        eventName: string
        dateRange?: { start?: string }
        provenance?: { source?: string }
        members?: number[][] | null
        hourly: Array<{ timestamp: string; precipitationMm: number }>
      }

      try {
        const raw = fs.readFileSync(replayPath, 'utf-8')
        replayData = JSON.parse(raw)
      } catch (err) {
        return apiError(`Corrupted replay file at ${sanitizedEvent}.json`, {
          status: 500,
          code: 'REPLAY_FILE_CORRUPT',
          internalError: err,
        })
      }

      const hours = replayData.hourly.map((h) => h.timestamp)
      const deterministic = replayData.hourly.map((h) => h.precipitationMm)
      const members = replayData.members || undefined

      const replayProvenance: Provenance = {
        kind: 'replay',
        source: replayData.provenance?.source || 'Open-Meteo ERA5-Land Reanalysis Archive',
        fetchedAt: new Date().toISOString(),
        note: members ? undefined : 'replay uses a single forecast',
      }

      series = {
        cityId,
        issueTime: replayData.dateRange?.start || hours[0] || new Date().toISOString(),
        hours,
        deterministic,
        members,
        model: 'era5_reanalysis_archive',
        gridKm: 25,
        provenance: replayProvenance,
      }
    }
    // 3. SCENARIO MODE
    else {
      const rawDuration = searchParams.get('durationH')
      const rawAntecedent = searchParams.get('antecedentMm72h')

      const parseResult = ScenarioInputSchema.safeParse({
        cityId,
        peakMm1h: rawPeak ? Number(rawPeak) : 30,
        durationH: rawDuration ? Number(rawDuration) : 3,
        antecedentMm72h: rawAntecedent !== null ? Number(rawAntecedent) : 0,
      })

      if (!parseResult.success) {
        const issueMessages = parseResult.error.issues
          .map((iss) => `${iss.path.join('.')}: ${iss.message}`)
          .join('; ')

        return apiError(`Validation failed: ${issueMessages}`, {
          status: 400,
          code: 'VALIDATION_ERROR',
          details: parseResult.error.flatten(),
        })
      }

      const input = parseResult.data
      antecedentMm72h = input.antecedentMm72h

      const { hours, values } = generateTriangularHyetograph(
        input.peakMm1h,
        input.durationH
      )

      series = {
        cityId,
        issueTime: new Date().toISOString(),
        hours: hours.map((h) => `+${h}h`),
        deterministic: values,
        model: 'triangular_hyetograph',
        gridKm: 1,
        provenance: createSimulatedRainfallProvenance(),
      }
    }

    // 4. TIMELINE & GRID EVALUATION
    const timeline = computeTimeline(series, config, susceptibility, antecedentMm72h)
    if (timeline.length === 0) {
      return apiError('Timeline could not be calculated from rainfall input.', {
        status: 500,
        code: 'TIMELINE_CALCULATION_FAILED',
      })
    }

    // Determine selected hour
    const rawT = searchParams.get('t')
    let selectedHour: number

    if (rawT !== null && rawT.trim() !== '') {
      const parsedT = parseInt(rawT, 10)
      if (isNaN(parsedT) || parsedT < 0 || parsedT >= timeline.length) {
        return apiError(
          `Invalid hour parameter 't'=${rawT}. Must be an integer between 0 and ${timeline.length - 1}.`,
          {
            status: 400,
            code: 'INVALID_HOUR_INDEX',
          }
        )
      }
      selectedHour = parsedT
    } else {
      // Default to hour with highest median RTI (deterministic tie-breaking: first occurrence)
      let bestHour = 0
      let maxRti = -1
      for (let h = 0; h < timeline.length; h++) {
        if (timeline[h].rtiP50 > maxRti) {
          maxRti = timeline[h].rtiP50
          bestHour = h
        }
      }
      selectedHour = bestHour
    }

    const gridResult = computeRiskGrid({
      config,
      susceptibility,
      series,
      hourIndex: selectedHour,
      antecedentMm72h,
    })

    // 5. RAINFALL SUMMARY & BEYOND CALIBRATION
    const allRain = series.deterministic || (series.members ? series.members[0] : [])
    const max1h = allRain.length > 0 ? Math.max(...allRain) : 0
    const sums24 = rollingSum(allRain, 24)
    const max24h = sums24.length > 0 ? Math.max(...sums24) : 0
    const maxTimelineRti = Math.max(...timeline.map((th) => th.rtiP50))

    // Threshold check: 1.5x extreme band cutoff (1.5 * 1.5 = 2.25)
    const extremeThreshold = config.rtiBandCutoffs ? config.rtiBandCutoffs[2] : 1.5
    const calibrationLimit = extremeThreshold * 1.5
    const beyondCalibration = maxTimelineRti > calibrationLimit
    const beyondCalibrationReason = beyondCalibration
      ? `Maximum RTI (${maxTimelineRti.toFixed(3)}) exceeds 1.5x extreme-band threshold (${calibrationLimit.toFixed(2)}). Values outside calibration are not reliable.`
      : undefined

    const provenanceList: Provenance[] = [
      series.provenance,
      createDerivedSusceptibilityProvenance(config.configHash),
      createDerivedRiskProvenance(
        config.thresholds.provisional
          ? 'PROVISIONAL — Relative waterlogging risk estimate based on provisional thresholds.'
          : 'Relative waterlogging risk estimate based on frozen configuration matrix.'
      ),
    ]

    const payload = {
      cityId,
      mode,
      status: adapterStatus,
      disclaimer: PERMANENT_DISCLAIMER,
      beyondCalibration,
      ...(beyondCalibration && { beyondCalibrationReason }),
      selectedHour: {
        hourIndex: selectedHour,
        timestamp: timeline[selectedHour]?.timestamp,
        medianRti: gridResult.medianRti,
        band: gridResult.band,
        confidence: gridResult.confidence,
        hasEnsemble: gridResult.hasEnsemble,
        classDistribution: gridResult.classDistribution,
        classShare: gridResult.classShare,
      },
      rainfallSummary: {
        max1h: Math.round(max1h * 100) / 100,
        max24h: Math.round(max24h * 100) / 100,
        maxRti: Math.round(maxTimelineRti * 1000) / 1000,
      },
      rainfall: {
        hours: series.hours || [],
        values: allRain,
        derived: {
          totalMm24h: Math.round(max24h * 100) / 100,
          maxMm1h: Math.round(max1h * 100) / 100,
        },
      },
      timeline,
      cells: gridResult.cells,
      classDistribution: gridResult.classDistribution,
      classShare: gridResult.classShare,
      provenance: provenanceList,
    }

    return apiSuccess(payload)
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err.message.includes('bail out of prerendering') ||
        (err as { digest?: string }).digest?.startsWith('DYNAMIC_SERVER_USAGE'))
    ) {
      throw err
    }
    const message = err instanceof Error ? err.message : 'Failed to query risk'
    return apiError(message, {
      status: 500,
      code: 'RISK_QUERY_FAILED',
      internalError: err,
    })
  }
}
