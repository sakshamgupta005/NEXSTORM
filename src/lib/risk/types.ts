/**
 * NEXSTORM Risk Core Type Contracts
 */

export type RiskClass = 'low' | 'moderate' | 'high'
export type RtiBand = 'none' | 'elevated' | 'severe' | 'extreme'
export type SBand = 'low' | 'mid' | 'high'
export type Confidence = 'high' | 'medium' | 'low' | 'unavailable'
export type ProvenanceKind =
  | 'live'
  | 'cached'
  | 'replay'
  | 'simulated'
  | 'derived'
  | 'official'

export interface Provenance {
  kind: ProvenanceKind
  source: string
  fetchedAt?: string
  validFrom?: string
  validTo?: string
  ageSeconds?: number
  note?: string
}

export interface RtiThresholds {
  T1h: number
  T3h: number
  T24h: number
  T72h: number
  provisional: boolean
}

export interface CellRisk {
  id: string
  s: number
  class: RiskClass
  p: {
    low: number
    moderate: number
    high: number
  }
  confidence: Confidence
}

export interface RainfallHyetograph {
  hours: number[]
  values: number[]
  derived: {
    totalMm24h: number
    maxMm1h: number
  }
}

export interface ScenarioResult {
  rainfall: RainfallHyetograph
  rti: {
    max: number
    band: RtiBand
  }
  cells: CellRisk[]
  classShare: {
    low: number
    moderate: number
    high: number
  }
  provenance: Provenance[]
}

export interface TimelineHour {
  hourIndex: number
  timestamp?: string
  rtiP10: number | null
  rtiP50: number
  rtiP90: number | null
  band: RtiBand
  classShare: {
    low: number
    moderate: number
    high: number
  }
}

export interface GridRiskResult {
  hourIndex: number
  timestamp?: string
  cells: CellRisk[]
  classDistribution: {
    low: number
    moderate: number
    high: number
  }
  classShare: {
    low: number
    moderate: number
    high: number
  }
  medianRti: number
  band: RtiBand
  confidence: Confidence
  hasEnsemble: boolean
}

