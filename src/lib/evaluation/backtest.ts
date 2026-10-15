/**
 * src/lib/evaluation/backtest.ts
 * Real Historical Backtesting Engine for NEXSTORM.
 * Replays historical weather chronologically through the risk engine,
 * computes rolling accumulations without future leakage, and evaluates
 * detection skill against independent historical incident records.
 */

import fs from 'node:fs'
import path from 'node:path'
import { getCityConfig, getCitySusceptibility } from '../city/registry'
import { computeRiskGrid } from '../risk/engine'
import { rollingSum } from '../risk/rti'
import type { RainfallSeries } from '../weather/types'
import { toAmritsarDateString } from '../weather/normalize'
import { loadAmritsarHistoricalArchive } from '../weather/historical'
import { wilsonInterval } from './metrics'

export interface HistoricalIncident {
  id: string
  name: string
  lat: number
  lon: number
  cellId: string
  sourceUrl?: string
  articleDate: string // YYYY-MM-DD
  evidence?: string
  precision?: string
}

export interface BacktestOptions {
  cityId?: string
  startDate?: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD
  warmupHours?: number // Default: 72 hours
  alertThresholdRti?: number // Default: 0.5
  baselineThresholdMm24h?: number // Default: 64.5 (IMD Heavy Rain)
  customSeries?: RainfallSeries
  customIncidents?: HistoricalIncident[]
}

export interface DailyBacktestRecord {
  date: string // YYYY-MM-DD (Amritsar local time)
  total24hMm: number
  max1hMm: number
  maxRti: number
  peakHourTimestamp: string
  isModelAlert: boolean
  isBaselineAlert: boolean
  highestRiskClass: 'low' | 'moderate' | 'high'
  highRiskCellCount: number
  moderateRiskCellCount: number
}

export interface EventEvaluationResult {
  date: string
  incidentCount: number
  locations: string[]
  cellIds: string[]
  maxRti: number
  total24hMm: number
  modelDetected: boolean
  baselineDetected: boolean
  detectedLeadTimeHours?: number
  cellSusceptibilities: Array<{ cellId: string; s: number; riskClass: string }>
}

export interface BacktestReport {
  cityId: string
  configHash: string
  evaluationSpan: {
    startDate: string
    endDate: string
    totalHours: number
    totalCalendarDays: number
    warmupHours: number
  }
  provenance: {
    rainfallSource: string
    rainfallModel: string
    resolutionKm: number
    incidentSource: string
  }
  sampleCounts: {
    totalEligibleDays: number
    reportedIncidentDays: number
    distinctIncidents: number
    monsoonSeasons: number
  }
  metrics: {
    model: {
      rule: string
      hits: number
      misses: number
      pod: number // Probability of Detection [0, 1]
      wilson95CI: [number, number]
      totalAlertDays: number
      alertDaysPerSeason: number
      unreportedAlertDays: number
    }
    baseline: {
      rule: string
      hits: number
      misses: number
      pod: number
      wilson95CI: [number, number]
      totalAlertDays: number
      alertDaysPerSeason: number
      unreportedAlertDays: number
    }
  }
  events: EventEvaluationResult[]
  missedEvents: Array<{ date: string; locations: string[]; reason: string }>
  dailySummary: DailyBacktestRecord[]
  scientificNonClaims: string[]
  limitations: string[]
}

/**
 * Loads the 15 documented Tribune historical incidents from hotspots.json.
 */
export function loadHistoricalIncidents(cityId = 'amritsar'): HistoricalIncident[] {
  const filePath = path.resolve(
    process.cwd(),
    'public',
    'data',
    'cities',
    cityId,
    'hotspots.json'
  )

  if (!fs.existsSync(filePath)) return []

  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

/**
 * Executes a deterministic historical backtest across genuine weather records.
 */
export function runHistoricalBacktest(options: BacktestOptions = {}): BacktestReport {
  const cityId = options.cityId || 'amritsar'
  const config = getCityConfig(cityId)
  const susceptibility = getCitySusceptibility(cityId)
  const warmupHours = options.warmupHours ?? 72
  const alertThresholdRti = options.alertThresholdRti ?? 0.5
  const baselineThresholdMm24h = options.baselineThresholdMm24h ?? 64.5

  // 1. Obtain weather series
  let series: RainfallSeries
  if (options.customSeries) {
    series = options.customSeries
  } else {
    const archiveResult = loadAmritsarHistoricalArchive({
      startDate: options.startDate || '2023-06-01',
      endDate: options.endDate || '2024-09-30',
      warmupHours,
    })

    if (!archiveResult.data) {
      throw new Error(`Failed to load historical weather archive: ${archiveResult.error || 'Unavailable'}`)
    }
    series = archiveResult.data
  }

  const rain = series.deterministic || (series.members ? series.members[0] : [])
  const times = series.hours
  const totalHours = times.length

  if (totalHours < warmupHours) {
    throw new Error(`Insufficient hourly records (${totalHours}) for warmup window of ${warmupHours}h`)
  }

  // 2. Load and group historical incidents
  const incidents = options.customIncidents || loadHistoricalIncidents(cityId)
  const incidentsByDate = new Map<string, HistoricalIncident[]>()

  for (const inc of incidents) {
    const date = inc.articleDate
    if (!incidentsByDate.has(date)) {
      incidentsByDate.set(date, [])
    }
    incidentsByDate.get(date)!.push(inc)
  }

  // Cell susceptibility lookup
  const cellSMap = new Map<string, number>()
  for (const f of susceptibility.features) {
    cellSMap.set(f.properties.id, f.properties.s)
  }

  // 3. Chronological simulation hour-by-hour (strictly h <= t)
  // Precompute rolling sums
  const p1 = rollingSum(rain, 1)
  const p3 = rollingSum(rain, 3)
  const p24 = rollingSum(rain, 24)
  const p72 = rollingSum(rain, 72)

  // Daily aggregations in Amritsar local time
  const dailyMap = new Map<string, {
    hours: number[]
    p24hValues: number[]
    rtis: number[]
    timestamps: string[]
  }>()

  for (let h = 0; h < totalHours; h++) {
    const ts = times[h]
    const dateStr = toAmritsarDateString(ts)

    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, { hours: [], p24hValues: [], rtis: [], timestamps: [] })
    }

    const dEntry = dailyMap.get(dateStr)!
    dEntry.hours.push(h)
    dEntry.timestamps.push(ts)

    // Calculate RTI at hour h using only antecedent and current hours
    const r1 = p1[h] / config.thresholds.T1h
    const r3 = p3[h] / config.thresholds.T3h
    const r24 = p24[h] / config.thresholds.T24h
    const r72 = p72[h] / config.thresholds.T72h
    const rti = Math.round(Math.max(r1, r3, r24, r72) * 1e6) / 1e6

    dEntry.rtis.push(rti)
    dEntry.p24hValues.push(p24[h])
  }

  // 4. Evaluate each calendar day
  const dailySummary: DailyBacktestRecord[] = []
  const modelAlertDates = new Set<string>()
  const baselineAlertDates = new Set<string>()

  for (const [dateStr, dData] of dailyMap.entries()) {
    let maxRti = 0
    let peakTimestamp = dData.timestamps[0]
    let peakHourIdx = dData.hours[0]

    for (let i = 0; i < dData.hours.length; i++) {
      if (dData.rtis[i] > maxRti) {
        maxRti = dData.rtis[i]
        peakTimestamp = dData.timestamps[i]
        peakHourIdx = dData.hours[i]
      }
    }

    // 24h total rain on this calendar day: sum of 1h values
    let total24h = 0
    let max1h = 0
    for (const hIdx of dData.hours) {
      total24h += rain[hIdx]
      if (rain[hIdx] > max1h) max1h = rain[hIdx]
    }
    total24h = Math.round(total24h * 10) / 10
    max1h = Math.round(max1h * 10) / 10

    // Evaluate cell risks at peak hour
    const gridRes = computeRiskGrid({
      config,
      susceptibility,
      series,
      hourIndex: peakHourIdx,
    })

    const isModelAlert = maxRti >= alertThresholdRti
    // Baseline alert: IMD daily rain >= 64.5 mm
    const isBaselineAlert = total24h >= baselineThresholdMm24h

    if (isModelAlert) modelAlertDates.add(dateStr)
    if (isBaselineAlert) baselineAlertDates.add(dateStr)

    dailySummary.push({
      date: dateStr,
      total24hMm: total24h,
      max1hMm: max1h,
      maxRti,
      peakHourTimestamp: peakTimestamp,
      isModelAlert,
      isBaselineAlert,
      highestRiskClass: gridRes.classDistribution.high > 0 ? 'high' : gridRes.classDistribution.moderate > 0 ? 'moderate' : 'low',
      highRiskCellCount: Math.round(gridRes.classDistribution.high * susceptibility.features.length),
      moderateRiskCellCount: Math.round(gridRes.classDistribution.moderate * susceptibility.features.length),
    })
  }

  // Sort daily summary chronologically
  dailySummary.sort((a, b) => a.date.localeCompare(b.date))

  // 5. Evaluate Against Ground Truth Event Days
  const eventDates = Array.from(incidentsByDate.keys()).sort()
  const events: EventEvaluationResult[] = []
  const missedEvents: Array<{ date: string; locations: string[]; reason: string }> = []

  let modelHits = 0
  let baselineHits = 0

  for (const evDate of eventDates) {
    const evList = incidentsByDate.get(evDate)!
    const locations = evList.map((i) => i.name)
    const cellIds = evList.map((i) => i.cellId).filter(Boolean)

    // Check publication lag / antecedent downpour window:
    // News articles on date D often report flooding caused by rain on date D-1 or D.
    // Check both evDate and previous day (evDate - 1 day)
    const prevDate = new Date(new Date(evDate).getTime() - 86400000).toISOString().slice(0, 10)

    const dStats = dailySummary.find((d) => d.date === evDate)
    const prevStats = dailySummary.find((d) => d.date === prevDate)

    const effectiveMaxRti = Math.max(dStats?.maxRti || 0, prevStats?.maxRti || 0)
    const effectiveTotal24h = Math.max(dStats?.total24hMm || 0, prevStats?.total24hMm || 0)

    const modelDetected = modelAlertDates.has(evDate) || modelAlertDates.has(prevDate)
    const baselineDetected = baselineAlertDates.has(evDate) || baselineAlertDates.has(prevDate)

    if (modelDetected) {
      modelHits++
    } else {
      missedEvents.push({
        date: evDate,
        locations,
        reason: `Max RTI (${effectiveMaxRti.toFixed(2)}) below ${alertThresholdRti} threshold; 24h rain: ${effectiveTotal24h} mm`,
      })
    }

    if (baselineDetected) {
      baselineHits++
    }

    // Cell susceptibility check for incident locations
    const cellSusceptibilities = cellIds.map((cid) => {
      const s = cellSMap.get(cid) ?? 0
      const sb = s < 0.33 ? 'low' : s <= 0.66 ? 'mid' : 'high'
      const risk = sb === 'high' ? (effectiveMaxRti >= 0.5 ? 'high' : 'moderate') : sb === 'mid' ? (effectiveMaxRti >= 1.0 ? 'moderate' : 'low') : 'low'
      return { cellId: cid, s, riskClass: risk }
    })

    events.push({
      date: evDate,
      incidentCount: evList.length,
      locations,
      cellIds,
      maxRti: effectiveMaxRti,
      total24hMm: effectiveTotal24h,
      modelDetected,
      baselineDetected,
      cellSusceptibilities,
    })
  }

  const nEvents = eventDates.length
  const modelPod = nEvents > 0 ? Math.round((modelHits / nEvents) * 10000) / 10000 : 0
  const baselinePod = nEvents > 0 ? Math.round((baselineHits / nEvents) * 10000) / 10000 : 0

  const modelWilsonCI = wilsonInterval(modelHits, nEvents, 0.95)
  const baselineWilsonCI = wilsonInterval(baselineHits, nEvents, 0.95)

  // Distinct seasons count
  const distinctYears = new Set(dailySummary.map((d) => d.date.slice(0, 4)))
  const nSeasons = Math.max(1, distinctYears.size)

  const alertDaysPerSeasonModel = Math.round((modelAlertDates.size / nSeasons) * 10) / 10
  const alertDaysPerSeasonBaseline = Math.round((baselineAlertDates.size / nSeasons) * 10) / 10

  const reportedEventSet = new Set(eventDates)
  const unreportedAlertDaysModel = Array.from(modelAlertDates).filter((d) => !reportedEventSet.has(d)).length
  const unreportedAlertDaysBaseline = Array.from(baselineAlertDates).filter((d) => !reportedEventSet.has(d)).length

  return {
    cityId,
    configHash: config.configHash,
    evaluationSpan: {
      startDate: options.startDate || dailySummary[0]?.date || series.hours[0].slice(0, 10),
      endDate: options.endDate || dailySummary[dailySummary.length - 1]?.date || series.hours[series.hours.length - 1].slice(0, 10),
      totalHours,
      totalCalendarDays: dailySummary.length,
      warmupHours,
    },
    provenance: {
      rainfallSource: series.provenance.source,
      rainfallModel: series.model,
      resolutionKm: series.gridKm,
      incidentSource: 'The Tribune Amritsar Archive (15 Documented Hotspot Reports)',
    },
    sampleCounts: {
      totalEligibleDays: dailySummary.length,
      reportedIncidentDays: nEvents,
      distinctIncidents: incidents.length,
      monsoonSeasons: nSeasons,
    },
    metrics: {
      model: {
        rule: `At least one cell moderate or high risk (Max RTI >= ${alertThresholdRti})`,
        hits: modelHits,
        misses: nEvents - modelHits,
        pod: modelPod,
        wilson95CI: modelWilsonCI,
        totalAlertDays: modelAlertDates.size,
        alertDaysPerSeason: alertDaysPerSeasonModel,
        unreportedAlertDays: unreportedAlertDaysModel,
      },
      baseline: {
        rule: `24-hour rainfall >= ${baselineThresholdMm24h} mm (IMD Heavy Rainfall Standard)`,
        hits: baselineHits,
        misses: nEvents - baselineHits,
        pod: baselinePod,
        wilson95CI: baselineWilsonCI,
        totalAlertDays: baselineAlertDates.size,
        alertDaysPerSeason: alertDaysPerSeasonBaseline,
        unreportedAlertDays: unreportedAlertDaysBaseline,
      },
    },
    events,
    missedEvents,
    dailySummary,
    scientificNonClaims: [
      'NEXSTORM does not predict flood depth in centimeters.',
      'Model outputs reflect rainfall-driven waterlogging hazard, not verified indoor inundation.',
      'Unreported days and locations are incomplete samples (unlabelled), not confirmed negative non-flooding zones.',
      'False Alarm Rate (FAR) cannot be computed without verified negative ground-truth logs across all 1,998 cells.',
    ],
    limitations: [
      'Reporting bias: newspaper articles focus predominantly on arterial commercial corridors and central underpasses.',
      'Spatial resolution: 11 km ERA5 reanalysis grid averages convective micro-scale thunderstorm cores over ~120 km².',
      'Publication lag: media accounts are published 12-24 hours after physical rainstorms.',
      'Small incident sample size (15 locations, 9 event dates) limits statistical significance.',
    ],
  }
}
