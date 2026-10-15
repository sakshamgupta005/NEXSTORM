/**
 * src/lib/city/readiness.ts
 * Implementation of the formal City Readiness State Machine for NEXSTORM P23.
 * Evaluates artifact completeness, geospatial validity, evidence depth, and operational safety.
 */

import fs from 'node:fs'
import path from 'node:path'
import { cityConfigSchema } from './schema'
import type { CityConfig, CityReadinessCheck, CityReadinessEvaluation, CityReadinessState } from './types'

export const READINESS_HIERARCHY: CityReadinessState[] = [
  'configuration_only',
  'data_bootstrapped',
  'model_generated',
  'evidence_insufficient',
  'evaluation_ready',
  'pilot_eligible',
]

/**
 * Evaluates a city's readiness by inspecting physical disk artifacts and validation boundaries.
 */
export function evaluateCityReadiness(cityId: string): CityReadinessEvaluation {
  const normId = (cityId || '').toLowerCase().trim()
  const cityDir = path.join(process.cwd(), 'public', 'data', 'cities', normId)
  const checks: CityReadinessCheck[] = []

  let config: CityConfig | null = null
  let determinedState: CityReadinessState = 'configuration_only'

  // Gate 1: Configuration Completeness & Schema Validation
  const configPath = path.join(cityDir, 'city.config.json')
  if (!fs.existsSync(configPath)) {
    checks.push({
      id: 'config_exists',
      name: 'Configuration File Exists',
      passed: false,
      message: `city.config.json missing in ${cityDir}`,
    })
    return {
      cityId: normId,
      cityName: normId,
      determinedState: 'configuration_only',
      isStateConsistent: false,
      checks,
      summary: { passedCount: 0, totalCount: 1 },
    }
  }

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    const parsed = cityConfigSchema.safeParse(raw)
    if (parsed.success) {
      config = parsed.data as CityConfig
      checks.push({
        id: 'config_schema',
        name: 'Configuration Schema Valid',
        passed: true,
        message: 'city.config.json conforms to strict Zod specification',
      })
    } else {
      checks.push({
        id: 'config_schema',
        name: 'Configuration Schema Valid',
        passed: false,
        message: `Schema error: ${JSON.stringify(parsed.error.format())}`,
      })
    }
  } catch (err) {
    checks.push({
      id: 'config_parse',
      name: 'Configuration JSON Parse',
      passed: false,
      message: `JSON parse error: ${err instanceof Error ? err.message : String(err)}`,
    })
  }

  const cityName = config?.name || normId

  // Gate 2: Data Bootstrapped (Boundary & Analysis Grid)
  const gridPath = path.join(cityDir, 'grid.geojson')
  let isGridValid = false
  if (fs.existsSync(gridPath)) {
    try {
      const grid = JSON.parse(fs.readFileSync(gridPath, 'utf-8'))
      if (grid.type === 'FeatureCollection' && Array.isArray(grid.features) && grid.features.length > 0) {
        isGridValid = true
        checks.push({
          id: 'grid_exists',
          name: 'Regular Metric Grid Generated',
          passed: true,
          message: `Analysis grid present with ${grid.features.length} cells`,
        })
        determinedState = 'data_bootstrapped'
      } else {
        checks.push({
          id: 'grid_exists',
          name: 'Regular Metric Grid Generated',
          passed: false,
          message: 'grid.geojson contains malformed FeatureCollection or zero features',
        })
      }
    } catch {
      checks.push({
        id: 'grid_exists',
        name: 'Regular Metric Grid Generated',
        passed: false,
        message: 'grid.geojson corrupted or unparseable',
      })
    }
  } else {
    checks.push({
      id: 'grid_exists',
      name: 'Regular Metric Grid Generated',
      passed: false,
      message: 'grid.geojson not yet generated',
    })
  }

  // Gate 3: Model Generated (Susceptibility Layer)
  const suscPath = path.join(cityDir, 'susceptibility.geojson')
  let isModelValid = false
  if (isGridValid && fs.existsSync(suscPath)) {
    try {
      const susc = JSON.parse(fs.readFileSync(suscPath, 'utf-8'))
      if (susc.type === 'FeatureCollection' && Array.isArray(susc.features) && susc.features.length > 0) {
        const hasSynthetic = susc.features.some(
          (f: { properties?: { synthetic?: boolean } }) => f?.properties?.synthetic === true
        )
        if (!hasSynthetic) {
          isModelValid = true
          checks.push({
            id: 'susceptibility_generated',
            name: 'Terrain Susceptibility Scored',
            passed: true,
            message: `Susceptibility GeoJSON valid with ${susc.features.length} scored cells (synthetic data strictly absent)`,
          })
          determinedState = 'model_generated'
        } else {
          checks.push({
            id: 'susceptibility_generated',
            name: 'Terrain Susceptibility Scored',
            passed: false,
            message: 'Synthetic data detected in susceptibility layer; rejected for production',
          })
        }
      }
    } catch {
      checks.push({
        id: 'susceptibility_generated',
        name: 'Terrain Susceptibility Scored',
        passed: false,
        message: 'susceptibility.geojson corrupted or unparseable',
      })
    }
  } else if (isGridValid) {
    checks.push({
      id: 'susceptibility_generated',
      name: 'Terrain Susceptibility Scored',
      passed: false,
      message: 'susceptibility.geojson missing; run feature extraction and scoring pipeline',
    })
  }

  // Gate 3b: Geospatial Data Quality & Observability Audit
  const qualityReportPath = path.join(cityDir, 'quality_report.json')
  if (fs.existsSync(qualityReportPath)) {
    try {
      const qReport = JSON.parse(fs.readFileSync(qualityReportPath, 'utf-8'))
      if (qReport?.auditVerdict?.technicalIntegrityPassed === true) {
        checks.push({
          id: 'quality_report_audit',
          name: 'Geospatial Data Quality Audit Passed',
          passed: true,
          message: `Quality audit passed with 0 fatal errors (${qReport.auditVerdict.warningCount || 0} warnings, calibration status: ${qReport.auditVerdict.calibrationStatus})`,
        })
      } else {
        checks.push({
          id: 'quality_report_audit',
          name: 'Geospatial Data Quality Audit Passed',
          passed: false,
          message: `Quality audit failed with ${qReport?.auditVerdict?.fatalErrorCount || 1} fatal errors: ${(qReport?.fatalErrors || []).join(', ')}`,
        })
        isModelValid = false
      }
    } catch {
      checks.push({
        id: 'quality_report_audit',
        name: 'Geospatial Data Quality Audit Passed',
        passed: false,
        message: 'quality_report.json unparseable or malformed',
      })
    }
  }

  // Gate 4: Ground Truth Incident Evidence Depth
  const inventoryPath = path.join(cityDir, 'incidents_inventory.json')
  let hasSufficientEvidence = false
  if (isModelValid) {
    if (fs.existsSync(inventoryPath)) {
      try {
        const incidents = JSON.parse(fs.readFileSync(inventoryPath, 'utf-8'))
        const validRainfall = Array.isArray(incidents)
          ? incidents.filter(
              (i: { inclusionDecision?: string; isRainfallDriven?: boolean }) =>
                i.inclusionDecision === 'included' && i.isRainfallDriven !== false
            )
          : []
        const distinctStorms = new Set(
          validRainfall.map(
            (i: { stormEventId?: string; articleDate?: string }) => i.stormEventId || i.articleDate
          )
        )

        // Requirement: At least 5 distinct documented rainfall storms to avoid tiny-sample overfitting.
        // Amritsar is the locally calibrated reference baseline with 7 storms across 13 municipal hotspots.
        // Secondary pilots with preliminary media reporting (source_reported) require city-specific
        // calibration and municipal ground telemetry before advancing beyond evidence_insufficient.
        const isCalibratedBaseline = normId === 'amritsar'

        if (distinctStorms.size >= 5 && isCalibratedBaseline) {
          hasSufficientEvidence = true
          checks.push({
            id: 'incident_evidence',
            name: 'Historical Incident Evidence Available',
            passed: true,
            message: `Documented archival incident inventory present (${validRainfall.length} locations across ${distinctStorms.size} distinct storms, newspaper-reported baseline)`,
          })
          determinedState = 'evaluation_ready'
        } else if (distinctStorms.size >= 5) {
          checks.push({
            id: 'incident_evidence',
            name: 'Historical Incident Evidence Available',
            passed: false,
            message: `Preliminary journalistic evidence inventory present (${validRainfall.length} locations across ${distinctStorms.size} storms, source_reported), but lacks historical ground-truth waterlogging data from independent field gauges or municipal registers`,
          })
          determinedState = 'evidence_insufficient'
        } else {
          checks.push({
            id: 'incident_evidence',
            name: 'Historical Incident Evidence Available',
            passed: false,
            message: `Insufficient historical incidents (${distinctStorms.size} storms < 5 storm threshold); lacks historical ground-truth waterlogging data to validate model skill`,
          })
          determinedState = 'evidence_insufficient'
        }
      } catch {
        checks.push({
          id: 'incident_evidence',
          name: 'Historical Incident Evidence Available',
          passed: false,
          message: 'incidents_inventory.json corrupted or malformed',
        })
        determinedState = 'evidence_insufficient'
      }
    } else {
      checks.push({
        id: 'incident_evidence',
        name: 'Historical Incident Evidence Available',
        passed: false,
        message: 'No incidents_inventory.json found; city lacks historical ground-truth waterlogging data',
      })
      determinedState = 'evidence_insufficient'
    }
  }

  // Gate 5: Pilot Eligibility (Operational Policy & Alert Configuration)
  if (hasSufficientEvidence && determinedState === 'evaluation_ready') {
    const isAlertsAllowed = config?.operationalStatus?.alertsAllowed === true
    if (isAlertsAllowed && normId === 'amritsar') {
      determinedState = 'pilot_eligible'
      checks.push({
        id: 'pilot_operational_eligibility',
        name: 'Production Pilot Eligible',
        passed: true,
        message: 'City satisfies all scientific, evidence, and operational requirements for pilot operations',
      })
    } else {
      checks.push({
        id: 'pilot_operational_eligibility',
        name: 'Production Pilot Eligible',
        passed: false,
        message: 'Operational alert dispatch restricted or pending operator sign-off',
      })
    }
  }

  const declaredState = config?.readinessState
  const isStateConsistent = declaredState ? declaredState === determinedState : true

  return {
    cityId: normId,
    cityName,
    determinedState,
    declaredState,
    isStateConsistent,
    checks,
    summary: {
      passedCount: checks.filter((c) => c.passed).length,
      totalCount: checks.length,
    },
  }
}
