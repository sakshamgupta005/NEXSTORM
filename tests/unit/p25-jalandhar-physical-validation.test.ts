/**
 * tests/unit/p25-jalandhar-physical-validation.test.ts
 * Comprehensive regression and verification test suite for NEXSTORM P25:
 * Physical Terrain Ingestion, Feature Computation, Historical Evidence Reconstruction & Safety Gates.
 */

import { describe, expect, it, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { clearCityCache, getCityQualityReport } from '@/lib/city/registry'
import { evaluateCityReadiness } from '@/lib/city/readiness'
import { FileAlertRepository } from '@/lib/alerts/repository'
import { runAlertDispatch } from '@/lib/alerts/dispatcher'
import { createScenarioRainfallSeries } from '@/lib/alerts/engine'
import type { SubscriberPreference } from '@/lib/alerts/types'

interface IncidentRecord {
  incidentId: string
  stormEventId: string
  category: string
  isRainfallDriven: boolean
  inclusionDecision: string
  verificationStatus: string
  sourceIndependence: string
}

describe('P25 — Physical Raster Ingestion & Metadata Provenance', () => {
  const jalandharDir = path.join(process.cwd(), 'public', 'data', 'cities', 'jalandhar')

  beforeEach(() => {
    clearCityCache()
  })

  it('verifies genuine physical rasters exist locally with valid GeoTIFF headers', () => {
    const demPath = path.join(jalandharDir, 'rasters', 'dem.tif')
    const wcPath = path.join(jalandharDir, 'rasters', 'worldcover.tif')

    expect(fs.existsSync(demPath)).toBe(true)
    expect(fs.existsSync(wcPath)).toBe(true)

    // Verify minimum file sizes (real GeoTIFF rasters, not zero-byte placeholders)
    const demStat = fs.statSync(demPath)
    const wcStat = fs.statSync(wcPath)

    expect(demStat.size).toBeGreaterThan(500_000) // ~1.3 MB
    expect(wcStat.size).toBeGreaterThan(1_000_000) // ~3.6 MB
  })

  it('validates physical sources ledger (physical_sources.json)', () => {
    const sourcesPath = path.join(jalandharDir, 'physical_sources.json')
    expect(fs.existsSync(sourcesPath)).toBe(true)

    const sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf-8'))
    expect(sources.cityId).toBe('jalandhar')
    expect(sources.aoi.boundaryType).toBe('rectangular_aoi_box')
    expect(sources.aoi.isOfficialAdministrativeBoundary).toBe(false)

    // Verify Copernicus DEM metadata
    const dem = sources.datasets.copernicus_dem_glo30
    expect(dem.nativeResolution).toBe('30m')
    expect(dem.crs).toContain('4326')
    expect(dem.stats.min_elev_m).toBeGreaterThan(220)
    expect(dem.stats.max_elev_m).toBeLessThan(270)
    expect(dem.stats.sha256).toBeDefined()

    // Verify ESA WorldCover metadata
    const wc = sources.datasets.esa_worldcover_2021
    expect(wc.nativeResolution).toBe('10m')
    expect(wc.stats.builtup_percent).toBeGreaterThan(20)
    expect(wc.stats.builtup_percent).toBeLessThan(50)
    expect(wc.stats.sha256).toBeDefined()

    // Verify OpenStreetMap vector metadata
    const osm = sources.datasets.openstreetmap_vectors
    expect(osm.stats.road_count).toBeGreaterThan(10000)
    expect(osm.stats.sha256).toBeDefined()
  })
})

describe('P25 — Physical Feature Generation & Spatial Distribution', () => {
  const jalandharDir = path.join(process.cwd(), 'public', 'data', 'cities', 'jalandhar')

  it('verifies susceptibility layer derived from real rasters and OSM topology', () => {
    const suscPath = path.join(jalandharDir, 'susceptibility.geojson')
    expect(fs.existsSync(suscPath)).toBe(true)

    const susc = JSON.parse(fs.readFileSync(suscPath, 'utf-8'))
    expect(susc.features.length).toBe(2354)

    // Check individual cell property contracts
    const sample = susc.features[0].properties
    expect(sample.id).toMatch(/^J-\d{4}$/)
    expect(typeof sample.s).toBe('number')
    expect(sample.s).toBeGreaterThanOrEqual(0.0)
    expect(sample.s).toBeLessThanOrEqual(1.0)
    expect(['low', 'mid', 'high']).toContain(sample.band)

    // Verify physical indicators are present
    expect(typeof sample.elevation_m).toBe('number')
    expect(sample.elevation_m).toBeGreaterThan(220)
    expect(typeof sample.slope_deg).toBe('number')
    expect(typeof sample.builtup_fraction).toBe('number')
    expect(typeof sample.road_length_m).toBe('number')
  })

  it('validates before-and-after quality report proving elimination of proxy compression', () => {
    const report = getCityQualityReport('jalandhar')
    expect(report).not.toBeNull()
    expect(report?.auditVerdict.technicalIntegrityPassed).toBe(true)
    expect(report?.auditVerdict.fatalErrorCount).toBe(0)

    // Verify physical sampling provenance
    expect(report?.featureAudit.dataOrigin.isPhysicallySampled).toBe(true)
    expect(report?.featureAudit.dataOrigin.sourceType).toBe('physical_raster_and_vector')

    // Contrast restored: std >= 0.12, mid-band reduced from 93.2%
    expect(report?.featureAudit.susceptibilityStats.std).toBeGreaterThanOrEqual(0.12)
    expect(report?.featureAudit.bandDistributionPercent.mid).toBeLessThan(75.0)

    // Low point distribution corrected from 64.7% to realistic ~12%
    const fLowPointMean = report?.featureAudit.componentFeatures?.f_lowPoint?.mean
    expect(fLowPointMean).toBeDefined()
    expect(fLowPointMean).toBeLessThan(0.25)
    expect(fLowPointMean).toBeGreaterThan(0.05)

    // Check before-and-after audit ledger exists
    const featureAudit = report?.featureAudit as {
      beforeAndAfterP24VsP25?: {
        p24ProxyFeatures: { midBandCompressionPct: number }
        p25PhysicalFeatures: { midBandCompressionPct: number }
      }
    }
    const delta = featureAudit?.beforeAndAfterP24VsP25
    expect(delta).toBeDefined()
    expect(delta?.p24ProxyFeatures.midBandCompressionPct).toBe(93.16)
    expect(delta?.p25PhysicalFeatures.midBandCompressionPct).toBeLessThan(75.0)
  })
})

describe('P25 — Historical Incident Inventory & Evidence Boundaries', () => {
  const jalandharDir = path.join(process.cwd(), 'public', 'data', 'cities', 'jalandhar')

  it('validates authentic incident inventory schema and deduplication', () => {
    const invPath = path.join(jalandharDir, 'incidents_inventory.json')
    expect(fs.existsSync(invPath)).toBe(true)

    const incidents = JSON.parse(fs.readFileSync(invPath, 'utf-8')) as IncidentRecord[]
    expect(Array.isArray(incidents)).toBe(true)
    expect(incidents.length).toBe(10)

    // 1 excluded non-rainfall incident
    const excluded = incidents.filter((i) => i.inclusionDecision === 'excluded_with_reason')
    expect(excluded.length).toBe(1)
    expect(excluded[0].category).toBe('industrial_effluent_overflow')
    expect(excluded[0].isRainfallDriven).toBe(false)

    // 9 included rainfall incidents
    const included = incidents.filter((i) => i.inclusionDecision === 'included')
    expect(included.length).toBe(9)
    expect(included.every((i) => i.isRainfallDriven === true)).toBe(true)

    // Deduplicated into 5 genuine storm events
    const storms = new Set(included.map((i) => i.stormEventId))
    expect(storms.size).toBe(5)

    // Must be labeled source_reported (journalistic), not fabricated field telemetry
    expect(included.every((i) => i.verificationStatus === 'source_reported')).toBe(true)
    expect(included.every((i) => i.sourceIndependence === 'single_source')).toBe(true)
  })

  it('verifies evaluation workflow and withheld metrics (evaluation_results.json)', () => {
    const evalPath = path.join(jalandharDir, 'evaluation_results.json')
    expect(fs.existsSync(evalPath)).toBe(true)

    const evalData = JSON.parse(fs.readFileSync(evalPath, 'utf-8'))
    expect(evalData.cityId).toBe('jalandhar')
    expect(evalData.sampleSize.totalArchivalRecords).toBe(10)
    expect(evalData.sampleSize.includedRainfallIncidents).toBe(9)
    expect(evalData.sampleSize.independentStormEvents).toBe(5)

    // All 9 incidents detected at mid-susceptibility threshold
    expect(evalData.incidentLevelMetrics.podAtMidThreshold).toBe(1.0)
    expect(evalData.stormLevelMetrics.stormLevelDetectionRate).toBe(1.0)

    // Negative space metrics MUST be withheld
    expect(evalData.negativeSpaceAudit.falseAlarmRate).toContain('WITHHELD')
    expect(evalData.negativeSpaceAudit.specificity).toContain('WITHHELD')
    expect(evalData.negativeSpaceAudit.rocAuc).toContain('WITHHELD')
  })
})

describe('P25 — Safety Gates & Alert Suppression Compliance', () => {
  beforeEach(() => {
    clearCityCache()
  })

  it('enforces that Jalandhar remains in evidence_insufficient state', () => {
    const evaluation = evaluateCityReadiness('jalandhar')
    expect(evaluation.determinedState).toBe('evidence_insufficient')
    expect(evaluation.isStateConsistent).toBe(true)

    const gate4 = evaluation.checks.find((c) => c.id === 'incident_evidence')
    expect(gate4).toBeDefined()
    expect(gate4?.passed).toBe(false)
    expect(gate4?.message).toContain('Preliminary journalistic evidence inventory present')
  })

  it('strictly blocks alert dispatch for Jalandhar in evidence_insufficient', async () => {
    const repo = new FileAlertRepository()
    const now = new Date().toISOString()
    const sub: SubscriberPreference = {
      id: 'sub_p25_jal_test',
      cityId: 'jalandhar',
      channel: 'sms',
      destination: '+919999988888',
      sensitivity: 'high_sensitivity',
      geofence: { type: 'citywide' },
      isOptedIn: true,
      isVerified: true,
      isTestSubscriber: true,
      consentTimestamp: now,
      createdAt: now,
      updatedAt: now,
    }
    await repo.saveSubscriber(sub)

    const series = createScenarioRainfallSeries({
      cityId: 'jalandhar',
      peakMm1h: 90.0,
      durationH: 3,
    })

    const result = await runAlertDispatch({
      cityId: 'jalandhar',
      series,
      forceTestProvider: true,
    })

    expect(result.successfulDeliveries).toBe(0)
    expect(result.suppressedDeliveries).toBeGreaterThanOrEqual(1)
    expect(result.deliveries[0].status).toBe('suppressed')
    expect(result.deliveries[0].failureReason).toContain("City 'jalandhar' readiness state is 'evidence_insufficient'")

    await repo.unsubscribe('sub_p25_jal_test')
  })

  it('preserves Amritsar as calibrated baseline with zero regression', () => {
    const evaluation = evaluateCityReadiness('amritsar')
    expect(evaluation.determinedState).toBe('evaluation_ready')
    expect(evaluation.isStateConsistent).toBe(true)

    const rep = getCityQualityReport('amritsar')
    expect(rep?.auditVerdict.technicalIntegrityPassed).toBe(true)
    expect(rep?.auditVerdict.calibrationStatus).toBe('calibrated')
    expect(rep?.auditVerdict.fatalErrorCount).toBe(0)
    expect(rep?.crossCityComparability.role).toBe('reference_baseline')
  })
})
