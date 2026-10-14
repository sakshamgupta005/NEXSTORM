/**
 * src/lib/risk/engine.ts
 * Real NEXSTORM Hydrometeorological Risk Engine.
 * Precomputes multi-window rainfall accumulations and evaluates 2D risk matrices
 * over geospatial susceptibility grids for ensemble and deterministic forecasts.
 */

import type { CityConfig, SusceptibilityGeoJson } from '../city/registry'
import type { RainfallSeries } from '../weather/types'
import { classDistribution, confidenceOf, displayedClass, type RiskDistribution } from './distribution'
import { riskClass, sBand } from './matrix'
import { computeRti, computeRtiSeries, rtiBand } from './rti'
import type {
  CellRisk,
  Confidence,
  GridRiskResult,
  RiskClass,
  RtiBand,
  SBand,
  TimelineHour,
} from './types'


export interface ComputeRiskGridOptions {
  config: CityConfig
  susceptibility: SusceptibilityGeoJson
  series: RainfallSeries
  hourIndex: number
  antecedentMm72h?: number
}

interface CellCounts {
  low: number
  mid: number
  high: number
  total: number
}

function getCellCountsBySBand(susceptibility: SusceptibilityGeoJson): CellCounts {
  let low = 0
  let mid = 0
  let high = 0

  for (const f of susceptibility.features) {
    const sb = sBand(f.properties.s)
    if (sb === 'low') low++
    else if (sb === 'mid') mid++
    else high++
  }

  const total = low + mid + high || 1
  return { low, mid, high, total }
}

/**
 * Computes exact class share proportions across the city for a given RTI band.
 */
export function computeClassShareForBand(
  band: RtiBand,
  counts: CellCounts
): { low: number; moderate: number; high: number } {
  const cLow = riskClass('low', band)
  const cMid = riskClass('mid', band)
  const cHigh = riskClass('high', band)

  let lowCount = 0
  let modCount = 0
  let highCount = 0

  if (cLow === 'low') lowCount += counts.low
  else if (cLow === 'moderate') modCount += counts.low
  else highCount += counts.low

  if (cMid === 'low') lowCount += counts.mid
  else if (cMid === 'moderate') modCount += counts.mid
  else highCount += counts.mid

  if (cHigh === 'low') lowCount += counts.high
  else if (cHigh === 'moderate') modCount += counts.high
  else highCount += counts.high

  return {
    low: Math.round((lowCount / counts.total) * 10000) / 10000,
    moderate: Math.round((modCount / counts.total) * 10000) / 10000,
    high: Math.round((highCount / counts.total) * 10000) / 10000,
  }
}

/**
 * Computes quantile from a sorted array of numbers (linear interpolation).
 */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]
  const index = (sorted.length - 1) * q
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index - lower
  const val = sorted[lower] * (1 - weight) + sorted[upper] * weight
  return Math.round(val * 1e6) / 1e6
}

/**
 * Computes hourly risk timeline for all forecast hours.
 */
export function computeTimeline(
  series: RainfallSeries,
  config: CityConfig,
  susceptibility?: SusceptibilityGeoJson,
  antecedentMm72h: number = 0
): TimelineHour[] {
  const cellCounts = susceptibility
    ? getCellCountsBySBand(susceptibility)
    : { low: 644, mid: 1198, high: 156, total: 1998 } // Default Amritsar distribution if not provided

  const hasEnsemble = Boolean(series.members && series.members.length >= 2)
  const hoursCount = series.hours?.length ||
    (hasEnsemble ? series.members![0].length : series.deterministic?.length || 0)

  if (hoursCount === 0) return []

  const timeline: TimelineHour[] = new Array(hoursCount)

  if (hasEnsemble) {
    const members = series.members!
    // Precompute RTI series for each member across all hours
    const memberRtiSeries = members.map((m) =>
      computeRtiSeries(m, config.thresholds, antecedentMm72h)
    )

    for (let h = 0; h < hoursCount; h++) {
      const hourRtis = memberRtiSeries.map((s) => s[h] ?? 0).sort((a, b) => a - b)
      const p10 = quantile(hourRtis, 0.1)
      const p50 = quantile(hourRtis, 0.5)
      const p90 = quantile(hourRtis, 0.9)
      const band = rtiBand(p50)
      const classShare = computeClassShareForBand(band, cellCounts)

      timeline[h] = {
        hourIndex: h,
        timestamp: series.hours?.[h],
        rtiP10: p10,
        rtiP50: p50,
        rtiP90: p90,
        band,
        classShare,
      }
    }
  } else {
    // Single deterministic series
    const rain = series.deterministic || (series.members ? series.members[0] : [])
    const rtiSeries = computeRtiSeries(rain, config.thresholds, antecedentMm72h)

    for (let h = 0; h < hoursCount; h++) {
      const rti = rtiSeries[h] ?? 0
      const band = rtiBand(rti)
      const classShare = computeClassShareForBand(band, cellCounts)

      timeline[h] = {
        hourIndex: h,
        timestamp: series.hours?.[h],
        rtiP10: null,
        rtiP50: rti,
        rtiP90: null,
        band,
        classShare,
      }
    }
  }

  return timeline
}

/**
 * Computes full cell-level risk grid, class distributions, and confidence
 * for the selected forecast hourIndex.
 */
export function computeRiskGrid(options: ComputeRiskGridOptions): GridRiskResult {
  const { config, susceptibility, series, hourIndex, antecedentMm72h = 0 } = options
  const hasEnsemble = Boolean(series.members && series.members.length >= 2)

  const sBands: SBand[] = ['low', 'mid', 'high']
  const cells: CellRisk[] = new Array(susceptibility.features.length)

  let medianRti: number
  let medianBand: RtiBand
  let gridConfidence: Confidence

  if (hasEnsemble) {
    const members = series.members!
    const memberRtis = members.map((m) =>
      computeRti(m, hourIndex, config.thresholds, antecedentMm72h)
    )
    const sortedRtis = [...memberRtis].sort((a, b) => a - b)
    medianRti = quantile(sortedRtis, 0.5)
    medianBand = rtiBand(medianRti)

    const memberBands = memberRtis.map((r) => rtiBand(r))

    // Precalculate distributions for each SBand across the ensemble
    const pBySBand: Record<SBand, RiskDistribution> = {
      low: { low: 0, moderate: 0, high: 0 },
      mid: { low: 0, moderate: 0, high: 0 },
      high: { low: 0, moderate: 0, high: 0 },
    }
    const displayedBySBand: Record<SBand, RiskClass> = {
      low: 'low',
      mid: 'low',
      high: 'low',
    }
    const confidenceBySBand: Record<SBand, Confidence> = {
      low: 'low',
      mid: 'low',
      high: 'low',
    }

    for (const sb of sBands) {
      const classes = memberBands.map((rb) => riskClass(sb, rb))
      const p = classDistribution(classes)
      const disp = displayedClass(p, config.displayThreshold)
      const conf = confidenceOf(classes, disp)

      pBySBand[sb] = p
      displayedBySBand[sb] = disp
      confidenceBySBand[sb] = conf
    }

    gridConfidence = confidenceBySBand['mid']

    // Map cells with O(1) lookups
    for (let i = 0; i < susceptibility.features.length; i++) {
      const f = susceptibility.features[i]
      const s = f.properties.s
      const sb = sBand(s)
      cells[i] = {
        id: f.properties.id,
        s,
        class: displayedBySBand[sb],
        p: pBySBand[sb],
        confidence: confidenceBySBand[sb],
      }
    }
  } else {
    // Deterministic series
    const rain = series.deterministic || (series.members ? series.members[0] : [])
    medianRti = computeRti(rain, hourIndex, config.thresholds, antecedentMm72h)
    medianBand = rtiBand(medianRti)
    gridConfidence = 'unavailable'

    const classBySBand: Record<SBand, RiskClass> = {
      low: riskClass('low', medianBand),
      mid: riskClass('mid', medianBand),
      high: riskClass('high', medianBand),
    }

    for (let i = 0; i < susceptibility.features.length; i++) {
      const f = susceptibility.features[i]
      const s = f.properties.s
      const sb = sBand(s)
      const c = classBySBand[sb]
      cells[i] = {
        id: f.properties.id,
        s,
        class: c,
        p: {
          low: c === 'low' ? 1 : 0,
          moderate: c === 'moderate' ? 1 : 0,
          high: c === 'high' ? 1 : 0,
        },
        confidence: 'unavailable',
      }
    }
  }

  const cellClasses = cells.map((c) => c.class)
  const classDist = classDistribution(cellClasses)
  const cellCounts = getCellCountsBySBand(susceptibility)
  const classShare = computeClassShareForBand(medianBand, cellCounts)

  return {
    hourIndex,
    timestamp: series.hours?.[hourIndex],
    cells,
    classDistribution: classDist,
    classShare,
    medianRti,
    band: medianBand,
    confidence: gridConfidence,
    hasEnsemble,
  }
}
