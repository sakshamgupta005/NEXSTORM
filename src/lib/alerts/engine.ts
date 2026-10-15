/**
 * src/lib/alerts/engine.ts
 * Server-side Alert Decision Engine for NEXSTORM P20.
 * Evaluates live or scenario risk outputs against configurable sensitivity thresholds.
 * Enforces data freshness, weather degradation boundaries, and explicit decision states.
 */

import crypto from 'node:crypto'
import { getCityConfig, getCitySusceptibility, isCitySupported } from '../city/registry'
import { computeRiskGrid } from '../risk/engine'
import { generateTriangularHyetograph } from '../risk/scenario'
import type { RainfallSeries } from '../weather/types'
import type { AlertDecision, AlertDecisionState, AlertSensitivity } from './types'

export const SENSITIVITY_THRESHOLDS: Record<AlertSensitivity, number> = {
  high_sensitivity: 0.5,
  moderate_sensitivity: 0.75,
  high_risk: 1.0,
  extreme: 1.5,
}

export const MAX_WEATHER_STALENESS_SECONDS = 3600 // 1 hour

/**
 * Helper to construct a standard RainfallSeries from triangular scenario parameters.
 */
export function createScenarioRainfallSeries(params: {
  cityId?: string
  peakMm1h: number
  durationH?: number
  antecedentMm72h?: number
}): RainfallSeries {
  const cityId = (params.cityId || 'amritsar').toLowerCase()
  const durationH = params.durationH ?? 4
  const hyeto = generateTriangularHyetograph(params.peakMm1h, durationH)
  const now = Date.now()
  const hours = hyeto.hours.map((h) => new Date(now + h * 3600000).toISOString())
  return {
    cityId,
    issueTime: new Date(now).toISOString(),
    hours,
    deterministic: hyeto.values,
    model: 'scenario_triangular',
    gridKm: 1,
    provenance: {
      kind: 'simulated',
      source: 'Deterministic Scenario Generator',
      fetchedAt: new Date(now).toISOString(),
      note: `Peak ${params.peakMm1h}mm/h over ${durationH}h, antecedent ${params.antecedentMm72h || 0}mm`,
    },
  }
}

export interface AlertEvaluationOptions {
  cityId?: string
  sensitivity?: AlertSensitivity
  customThreshold?: number
  series?: RainfallSeries
  hourIndex?: number
  isWeatherUnavailable?: boolean
  weatherError?: string
}

/**
 * Evaluates a city's current or simulated risk state to produce an authoritative alert decision.
 * An alert decision represents modeled elevated risk, NEVER a verified flood occurrence.
 */
export function evaluateAlertDecision(options: AlertEvaluationOptions = {}): AlertDecision {
  const cityId = (options.cityId || 'amritsar').toLowerCase()
  if (!isCitySupported(cityId)) {
    throw new Error(`Unsupported cityId '${cityId}' for alert evaluation`)
  }

  const sensitivity = options.sensitivity || 'moderate_sensitivity'
  const thresholdApplied = options.customThreshold ?? SENSITIVITY_THRESHOLDS[sensitivity]
  const evaluatedAt = new Date().toISOString()
  const decisionId = `DEC-${cityId.toUpperCase()}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`

  // 1. Weather Availability Guard
  if (options.isWeatherUnavailable || !options.series) {
    return {
      decisionId,
      cityId,
      evaluatedAt,
      state: 'unavailable_weather',
      sensitivity,
      thresholdApplied,
      maxRti: 0,
      highestRiskCategory: 'low',
      weatherSource: 'Unavailable',
      weatherFreshness: {
        isStale: true,
        fetchedAt: evaluatedAt,
        ageSeconds: Infinity,
        source: 'None',
      },
      isDegraded: true,
      permitted: false,
      suppressionReason: options.weatherError
        ? `Weather data unavailable (${options.weatherError}); alert generation suppressed.`
        : 'Upstream weather data is completely unavailable; alert generation suppressed.',
      reason: 'Suppressed: Weather data unavailable.',
      affectedCells: [],
      affectedRoadIds: [],
      modelMetadata: {
        engineVersion: '2.0.0',
        configHash: 'none',
      },
    }
  }

  const series = options.series
  const config = getCityConfig(cityId)
  const susceptibility = getCitySusceptibility(cityId)

  // 2. Weather Freshness & Degradation Guard
  const fetchedAt = series.provenance?.fetchedAt || evaluatedAt
  const ageSeconds = Math.max(0, Math.floor((Date.now() - new Date(fetchedAt).getTime()) / 1000))
  const isStale = ageSeconds > MAX_WEATHER_STALENESS_SECONDS
  const isDegraded = Boolean(series.dataQuality?.isDegraded || isStale)
  const weatherSourceName = series.provenance?.source || 'Scenario/Simulated'

  // 3. Compute Risk Grid at target hour
  const hourIndex = options.hourIndex ?? 0
  let gridRes
  try {
    gridRes = computeRiskGrid({
      config,
      susceptibility,
      series,
      hourIndex,
    })
  } catch (err) {
    return {
      decisionId,
      cityId,
      evaluatedAt,
      state: 'evaluation_failure',
      sensitivity,
      thresholdApplied,
      maxRti: 0,
      highestRiskCategory: 'low',
      weatherSource: weatherSourceName,
      weatherFreshness: {
        isStale,
        fetchedAt,
        ageSeconds,
        source: weatherSourceName,
      },
      isDegraded: true,
      permitted: false,
      suppressionReason: `Risk computation failure: ${err instanceof Error ? err.message : String(err)}`,
      reason: 'Suppressed: Evaluation failure.',
      affectedCells: [],
      affectedRoadIds: [],
      modelMetadata: {
        engineVersion: '2.0.0',
        configHash: config.configHash,
      },
    }
  }

  const maxRti = gridRes.medianRti
  const highestRiskCategory: 'low' | 'moderate' | 'high' =
    gridRes.classDistribution.high > 0
      ? 'high'
      : gridRes.classDistribution.moderate > 0
      ? 'moderate'
      : 'low'

  const affectedCells = gridRes.cells
    .filter((c) => c.class === 'high' || c.class === 'moderate')
    .map((c) => c.id)

  const cellRoadMap = new Map<string, string>()
  for (const f of susceptibility.features) {
    if (f.properties.nearestRoad) {
      cellRoadMap.set(f.properties.id, f.properties.nearestRoad)
    }
  }

  const affectedRoadIds = affectedCells
    .map((id) => cellRoadMap.get(id))
    .filter((r): r is string => Boolean(r))

  // Deduplicate road IDs
  const uniqueRoadIds = Array.from(new Set(affectedRoadIds))

  // 4. Stale Weather Suppression Rule
  if (isStale) {
    return {
      decisionId,
      cityId,
      evaluatedAt,
      state: 'stale_data',
      sensitivity,
      thresholdApplied,
      maxRti,
      highestRiskCategory,
      weatherSource: weatherSourceName,
      weatherFreshness: {
        isStale: true,
        fetchedAt,
        ageSeconds,
        source: weatherSourceName,
      },
      isDegraded: true,
      permitted: false,
      suppressionReason: `Weather data is stale (${ageSeconds}s > ${MAX_WEATHER_STALENESS_SECONDS}s). Outbound public alert dispatch suppressed to avoid false warnings.`,
      reason: 'Suppressed: Stale weather input.',
      affectedCells,
      affectedRoadIds: uniqueRoadIds,
      modelMetadata: {
        engineVersion: '2.0.0',
        configHash: config.configHash,
      },
    }
  }

  // 5. Threshold Evaluation
  if (maxRti < thresholdApplied) {
    return {
      decisionId,
      cityId,
      evaluatedAt,
      state: 'normal',
      sensitivity,
      thresholdApplied,
      maxRti,
      highestRiskCategory,
      weatherSource: weatherSourceName,
      weatherFreshness: {
        isStale: false,
        fetchedAt,
        ageSeconds,
        source: weatherSourceName,
      },
      isDegraded,
      permitted: false,
      reason: `Normal: Max RTI (${maxRti.toFixed(2)}) is below the sensitivity threshold (${thresholdApplied.toFixed(2)}).`,
      affectedCells: [],
      affectedRoadIds: [],
      modelMetadata: {
        engineVersion: '2.0.0',
        configHash: config.configHash,
      },
    }
  }

  // Determine severity
  const isSevere = maxRti >= 1.5 || highestRiskCategory === 'high'
  const state: AlertDecisionState = isSevere ? 'severe_risk' : 'elevated_risk'

  return {
    decisionId,
    cityId,
    evaluatedAt,
    state,
    sensitivity,
    thresholdApplied,
    maxRti,
    highestRiskCategory,
    weatherSource: weatherSourceName,
    weatherFreshness: {
      isStale: false,
      fetchedAt,
      ageSeconds,
      source: weatherSourceName,
    },
    isDegraded,
    permitted: true,
    reason: `Elevated Modeled Hazard: Max RTI (${maxRti.toFixed(2)}) reached threshold (${thresholdApplied.toFixed(2)}) with ${affectedCells.length} affected cells.`,
    affectedCells,
    affectedRoadIds: uniqueRoadIds,
    modelMetadata: {
      engineVersion: '2.0.0',
      configHash: config.configHash,
    },
  }
}
