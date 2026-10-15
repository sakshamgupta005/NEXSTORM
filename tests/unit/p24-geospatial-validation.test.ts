/**
 * tests/unit/p24-geospatial-validation.test.ts
 * Comprehensive regression and verification test suite for NEXSTORM P24:
 * Independent Geospatial Validation, Cross-City Calibration & Quality Observability.
 */

import { describe, expect, it, beforeEach } from 'vitest'
import {
  clearCityCache,
  getCityQualityReport,
} from '@/lib/city/registry'
import { evaluateCityReadiness } from '@/lib/city/readiness'
import { FileAlertRepository } from '@/lib/alerts/repository'
import { runAlertDispatch } from '@/lib/alerts/dispatcher'
import { createScenarioRainfallSeries } from '@/lib/alerts/engine'
import type { SubscriberPreference } from '@/lib/alerts/types'

describe('P24 — City Quality Observability & Provenance Honesty', () => {
  beforeEach(() => {
    clearCityCache()
  })

  it('loads valid machine-readable quality report for Amritsar', () => {
    const report = getCityQualityReport('amritsar')
    expect(report).not.toBeNull()
    expect(report?.cityId).toBe('amritsar')
    expect(report?.auditVerdict.technicalIntegrityPassed).toBe(true)
    expect(report?.auditVerdict.calibrationStatus).toBe('calibrated')
    expect(report?.auditVerdict.fatalErrorCount).toBe(0)
    expect(report?.auditVerdict.warningCount).toBe(0)
    expect(report?.auditVerdict.evidenceLimitationCount).toBe(0)

    // Verify physical sampling provenance
    expect(report?.featureAudit.dataOrigin.isPhysicallySampled).toBe(true)
    expect(report?.featureAudit.dataOrigin.sourceType).toBe('physical_raster_and_vector')

    // Verify spatial grid parameters
    expect(report?.gridAudit.cellCount).toBe(1998)
    expect(report?.gridAudit.boundaryType).toBe('official_municipal_perimeter')
    expect(report?.gridAudit.metricCellArea.expectedAreaM2).toBe(62500)
    expect(report?.gridAudit.metricCellArea.meanAreaM2).toBe(62500)

    // Verify balanced susceptibility distribution
    expect(report?.featureAudit.susceptibilityStats.min).toBe(0.0)
    expect(report?.featureAudit.susceptibilityStats.max).toBe(1.0)
    expect(report?.featureAudit.susceptibilityStats.std).toBeGreaterThan(0.15)
    expect(report?.featureAudit.bandDistributionPercent.low).toBeGreaterThan(25.0)
    expect(report?.featureAudit.bandDistributionPercent.mid).toBeGreaterThan(50.0)
    expect(report?.featureAudit.bandDistributionPercent.high).toBeGreaterThan(5.0)
  })

  it('loads valid machine-readable quality report for Jalandhar with honest provenance and before-and-after tracking', () => {
    const report = getCityQualityReport('jalandhar')
    expect(report).not.toBeNull()
    expect(report?.cityId).toBe('jalandhar')
    expect(report?.auditVerdict.technicalIntegrityPassed).toBe(true)
    expect(report?.auditVerdict.calibrationStatus).toBe('uncalibrated_exploratory')
    expect(report?.auditVerdict.readinessState).toBe('evidence_insufficient')
    expect(report?.auditVerdict.fatalErrorCount).toBe(0)

    // Jalandhar boundary honesty: must declare rectangular AOI box, not official municipal boundary
    expect(report?.gridAudit.boundaryType).toBe('rectangular_aoi_box')

    // Preserved P24 baseline proxy audit in beforeAndAfter ledger
    const featureAudit = report?.featureAudit as {
      beforeAndAfterP24VsP25?: {
        p24ProxyFeatures: {
          sourceType: string
          susceptibilityStd: number
          midBandCompressionPct: number
        }
      }
    }
    const beforeP24 = featureAudit?.beforeAndAfterP24VsP25?.p24ProxyFeatures
    expect(beforeP24).toBeDefined()
    expect(beforeP24?.sourceType).toBe('analytic_coordinate_proxy')
    expect(beforeP24?.susceptibilityStd).toBeLessThan(0.10)
    expect(beforeP24?.midBandCompressionPct).toBeGreaterThan(90.0)

    // P25 upgraded physical sampling: verified physical rasters and restored spatial contrast
    expect(report?.featureAudit.dataOrigin.isPhysicallySampled).toBe(true)
    expect(report?.featureAudit.dataOrigin.sourceType).toBe('physical_raster_and_vector')
    expect(report?.featureAudit.susceptibilityStats.std).toBeGreaterThanOrEqual(0.12)
    expect(report?.featureAudit.bandDistributionPercent.mid).toBeLessThan(75.0)

    // Evidence audit: 5 distinct storm events reconstructed from media archives, but remains source_reported
    expect(report?.evidenceAudit.hasHistoricalEvidence).toBe(true)
    expect(report?.evidenceAudit.distinctStormEvents).toBe(5)
    expect(report?.auditVerdict.evidenceLimitationCount).toBe(1)
  })

  it('declares cross-city score non-equivalence in quality report', () => {
    const amritsarRep = getCityQualityReport('amritsar')
    const jalandharRep = getCityQualityReport('jalandhar')

    expect(amritsarRep?.crossCityComparability.role).toBe('reference_baseline')
    expect(amritsarRep?.crossCityComparability.isTransferredWithoutCalibration).toBe(false)

    expect(jalandharRep?.crossCityComparability.role).toBe('secondary_exploratory_pilot')
    expect(jalandharRep?.crossCityComparability.isTransferredWithoutCalibration).toBe(true)
    expect(jalandharRep?.crossCityComparability.crossCityScoreEquivalence).toContain('NON-EQUIVALENT')
  })

  it('returns null for unconfigured or unknown cities', () => {
    expect(getCityQualityReport('unknown_city')).toBeNull()
    expect(getCityQualityReport('')).toBeNull()
  })
})

describe('P24 — City Readiness State Machine with Quality Audit Integration', () => {
  beforeEach(() => {
    clearCityCache()
  })

  it('passes Gate 3b (Geospatial Data Quality Audit) for Amritsar', () => {
    const evaluation = evaluateCityReadiness('amritsar')
    expect(evaluation.determinedState).toBe('evaluation_ready')
    expect(evaluation.isStateConsistent).toBe(true)

    const gate3b = evaluation.checks.find((c) => c.id === 'quality_report_audit')
    expect(gate3b).toBeDefined()
    expect(gate3b?.passed).toBe(true)
    expect(gate3b?.message).toContain('Quality audit passed with 0 fatal errors')
  })

  it('passes Gate 3b for Jalandhar but halts at Gate 4 (Historical Evidence)', () => {
    const evaluation = evaluateCityReadiness('jalandhar')
    expect(evaluation.determinedState).toBe('evidence_insufficient')
    expect(evaluation.isStateConsistent).toBe(true)

    const gate3b = evaluation.checks.find((c) => c.id === 'quality_report_audit')
    expect(gate3b).toBeDefined()
    expect(gate3b?.passed).toBe(true)

    const gate4 = evaluation.checks.find((c) => c.id === 'incident_evidence')
    expect(gate4).toBeDefined()
    expect(gate4?.passed).toBe(false)
    expect(gate4?.message).toContain('lacks historical ground-truth waterlogging data')
  })
})

describe('P24 — Multi-City Alert Isolation & Suppression Regression', () => {
  it('strictly suppresses alert dispatch for Jalandhar in evidence_insufficient state', async () => {
    const repo = new FileAlertRepository()

    const now = new Date().toISOString()
    // Add a subscriber for Jalandhar
    const sub: SubscriberPreference = {
      id: 'sub_jal_test_01',
      cityId: 'jalandhar',
      channel: 'sms',
      destination: '+919876543210',
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

    // Trigger alert dispatch for Jalandhar under extreme rainfall
    const series = createScenarioRainfallSeries({
      cityId: 'jalandhar',
      peakMm1h: 80.0,
      durationH: 3,
    })
    const result = await runAlertDispatch({
      cityId: 'jalandhar',
      series,
      forceTestProvider: true,
    })

    // Must be suppressed because city is in evidence_insufficient state
    expect(result.killSwitchActive).toBe(false)
    expect(result.successfulDeliveries).toBe(0)
    expect(result.suppressedDeliveries).toBeGreaterThanOrEqual(1)
    expect(result.deliveries.length).toBeGreaterThanOrEqual(1)
    expect(result.deliveries.every((d) => d.status === 'suppressed')).toBe(true)
    expect(result.deliveries[0].failureReason).toContain("City 'jalandhar' readiness state is 'evidence_insufficient'")

    // Cleanup
    await repo.unsubscribe('sub_jal_test_01')
  })

  it('refuses alert dispatch for unknown city IDs without falling back to Amritsar', async () => {
    const series = createScenarioRainfallSeries({
      cityId: 'amritsar',
      peakMm1h: 50.0,
      durationH: 3,
    })

    await expect(
      runAlertDispatch({
        cityId: 'nonexistent_city_xyz',
        series,
        forceTestProvider: true,
      })
    ).rejects.toThrowError(/Unsupported cityId 'nonexistent_city_xyz'/)
  })
})
