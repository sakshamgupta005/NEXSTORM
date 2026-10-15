/**
 * src/lib/city/types.ts
 * Type definitions for NEXSTORM Multi-City Platform, Configuration Contracts,
 * Readiness State Machine, and Bootstrap Manifests.
 */

import type { RiskClass, RtiThresholds } from '../risk/types'

/**
 * Formal City Readiness State Machine:
 * 1. configuration_only: Configuration schema and hash valid, but grid and rasters unbuilt.
 * 2. data_bootstrapped: Boundary and regular metric analysis grid generated.
 * 3. model_generated: Feature extraction and susceptibility scoring completed.
 * 4. evidence_insufficient: Susceptibility map generated, but city lacks verified ground-truth incidents.
 *                           Permitted for internal exploratory research, strictly prohibited for live alerts.
 * 5. evaluation_ready: City-specific historical backtest completed with documented POD and sensitivity.
 * 6. pilot_eligible: Full production readiness: evaluation ready + weather connectivity + alert safeguards.
 */
export type CityReadinessState =
  | 'configuration_only'
  | 'data_bootstrapped'
  | 'model_generated'
  | 'evidence_insufficient'
  | 'evaluation_ready'
  | 'pilot_eligible'

export interface CityConfig {
  id: string
  name: string
  state?: string
  country?: string
  timezone?: string
  locale?: string
  bbox: [number, number, number, number] // [minLon, minLat, maxLon, maxLat]
  center?: [number, number] // [lat, lon]
  crs?: string // Default: EPSG:4326
  utmCrs?: string // Default: EPSG:32643
  gridSizeM: number
  cellCount: number
  readinessState?: CityReadinessState
  weights: {
    depression: number
    flatness: number
    builtUp: number
    lowPoint: number
    densityProxy: number
    [key: string]: number
  }
  terrainOverride: {
    applied: boolean
    reason: string
    std: number
  }
  sBandCutoffs: [number, number]
  rtiBandCutoffs: [number, number, number]
  matrix: RiskClass[][]
  thresholds: RtiThresholds & {
    derivedFrom?: string
    span?: string
  }
  displayThreshold: number
  confidenceCutoffs: [number, number]
  sources: string[]
  provenance?: {
    demSource?: string
    landCoverSource?: string
    osmSource?: string
    weatherSource?: string
    incidentSource?: string
    bootstrappedAt?: string
  }
  operationalStatus?: {
    alertsAllowed: boolean
    rolloutModeDefault: 'evaluation_only' | 'test_mode' | 'canary' | 'general_availability'
    restrictionsNote?: string
  }
  version: string
  configHash: string
}

export interface SusceptibilityFeatureProperties {
  id: string
  s: number
  f_depression?: number
  f_flatness?: number
  f_builtUp?: number
  f_lowPoint?: number
  f_density?: number
  nearestRoad?: string
  synthetic?: boolean
  version?: string
}

export interface SusceptibilityFeature {
  type: 'Feature'
  id?: string
  geometry: {
    type: 'Polygon'
    coordinates: number[][][]
  }
  properties: SusceptibilityFeatureProperties
}

export interface SusceptibilityGeoJson {
  type: 'FeatureCollection'
  name?: string
  crs?: {
    type: string
    properties: {
      name: string
    }
  }
  features: SusceptibilityFeature[]
}

export interface HotspotRecord {
  id: string
  name: string
  lat: number
  lon: number
  cellId: string
  sourceUrl?: string
  articleDate?: string
  evidence: string
  precision: string
}

export interface CityBootstrapManifest {
  manifestVersion: string
  cityId: string
  cityName: string
  state: string
  country: string
  timezone: string
  bootstrappedAt: string
  readinessState: CityReadinessState
  geographicBounds: {
    bbox: [number, number, number, number]
    crs: string
    targetUtmCrs: string
    cellResolutionMeters: number
    totalCells: number
  }
  datasetProvenance: {
    boundaryFile?: string
    gridFile?: string
    susceptibilityFile?: string
    featuresFile?: string
    checksums: Record<string, string>
  }
  featureDistributionSummary: {
    meanSusceptibility: number
    stdSusceptibility: number
    lowBandPercent: number
    midBandPercent: number
    highBandPercent: number
  }
  evidenceAudit: {
    incidentCount: number
    rainfallStormCount: number
    hasHistoricalEvidence: boolean
    evidenceAssessment: string
  }
  operationalPolicy: {
    isPilotEligible: boolean
    alertsPermitted: boolean
    defaultRolloutMode: string
    restrictions: string[]
  }
  warnings: string[]
  passedChecks: string[]
}

export interface CityReadinessCheck {
  id: string
  name: string
  passed: boolean
  message: string
}

export interface CityReadinessEvaluation {
  cityId: string
  cityName: string
  determinedState: CityReadinessState
  declaredState?: CityReadinessState
  isStateConsistent: boolean
  checks: CityReadinessCheck[]
  summary: {
    passedCount: number
    totalCount: number
  }
}

export interface CityQualityReport {
  reportVersion: string
  generatedAt: string
  cityId: string
  cityName: string
  auditVerdict: {
    technicalIntegrityPassed: boolean
    calibrationStatus: 'calibrated' | 'uncalibrated_exploratory'
    readinessState: CityReadinessState
    fatalErrorCount: number
    warningCount: number
    evidenceLimitationCount: number
  }
  fatalErrors: string[]
  warnings: string[]
  evidenceLimitations: string[]
  passedChecks: string[]
  gridAudit: {
    cellCount: number
    crs: string
    metricCellArea: {
      expectedAreaM2: number
      minAreaM2: number
      maxAreaM2: number
      meanAreaM2: number
      areaStdM2: number
    }
    spatialBoundsWgs84: [number, number, number, number]
    crsEvaluation: string
    boundaryType: string
    edgeCellHandling: string
  }
  featureAudit: {
    featureCount: number
    susceptibilityStats: {
      min: number
      max: number
      mean: number
      std: number
      p25: number
      p50: number
      p75: number
    }
    bandDistributionPercent: {
      low: number
      mid: number
      high: number
    }
    componentFeatures: Record<
      string,
      {
        min: number
        max: number
        mean: number
        std: number
      }
    >
    dataOrigin: {
      sourceType: string
      provenanceNote: string
      isPhysicallySampled: boolean
    }
  }
  evidenceAudit: {
    incidentCount: number
    validRainfallIncidents: number
    distinctStormEvents: number
    hasHistoricalEvidence: boolean
  }
  crossCityComparability: {
    role: string
    crossCityScoreEquivalence: string
    isTransferredWithoutCalibration: boolean
  }
}
