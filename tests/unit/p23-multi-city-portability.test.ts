/**
 * tests/unit/p23-multi-city-portability.test.ts
 * Comprehensive regression and verification test suite for NEXSTORM P23:
 * Multi-City Portability, Geographic Bootstrapping & Production Packaging.
 */

import { describe, expect, it, beforeEach } from 'vitest'
import {
  clearCityCache,
  getCityConfig,
  getCityManifest,
  isCitySupported,
  listSupportedCities,
  verifyConfigIntegrity,
} from '@/lib/city/registry'
import { evaluateCityReadiness } from '@/lib/city/readiness'
import { cityConfigSchema } from '@/lib/city/schema'
import { FileAlertRepository } from '@/lib/alerts/repository'
import { runAlertDispatch } from '@/lib/alerts/dispatcher'
import { createScenarioRainfallSeries } from '@/lib/alerts/engine'
import { runDeploymentPreflight } from '@/lib/alerts/preflight'
import { toAmritsarDateString, toCityDateString } from '@/lib/weather/normalize'
import type { DeliveryRecord, SubscriberPreference } from '@/lib/alerts/types'

describe('P23 — Multi-City Registry & Configuration Validation', () => {
  beforeEach(() => {
    clearCityCache()
  })

  it('correctly discovers and lists supported cities on disk', () => {
    const cities = listSupportedCities()
    expect(cities).toContain('amritsar')
    expect(cities).toContain('jalandhar')
    expect(isCitySupported('amritsar')).toBe(true)
    expect(isCitySupported('jalandhar')).toBe(true)
    expect(isCitySupported('AMRITSAR')).toBe(true)
    expect(isCitySupported('unknown_city')).toBe(false)
  })

  it('loads Amritsar configuration with verified canonical hash', () => {
    const config = getCityConfig('amritsar')
    expect(config.id).toBe('amritsar')
    expect(config.gridSizeM).toBe(250)
    expect(config.cellCount).toBe(1998)
    expect(config.configHash).toBe('74f463261a4c15cdc850b8d5be687bee4e59fd2950b7b93395449f3dacefcd49')
    expect(() => verifyConfigIntegrity(config)).not.toThrow()
  })

  it('loads Jalandhar configuration and manifest with verified integrity', () => {
    const config = getCityConfig('jalandhar')
    expect(config.id).toBe('jalandhar')
    expect(config.name).toBe('Jalandhar')
    expect(config.gridSizeM).toBe(250)
    expect(config.cellCount).toBeGreaterThan(1000)
    expect(config.readinessState).toBe('evidence_insufficient')
    expect(() => verifyConfigIntegrity(config)).not.toThrow()

    const manifest = getCityManifest('jalandhar')
    expect(manifest).not.toBeNull()
    expect(manifest?.cityId).toBe('jalandhar')
    expect(manifest?.readinessState).toBe('evidence_insufficient')
    expect(manifest?.operationalPolicy.alertsPermitted).toBe(false)
  })

  it('strictly rejects unnormalized weights in city config schema', () => {
    const valid = getCityConfig('amritsar')
    const badWeights = {
      ...valid,
      weights: {
        ...valid.weights,
        depression: 0.8, // Sum now 1.5, not 1.0
      },
    }
    const result = cityConfigSchema.safeParse(badWeights)
    expect(result.success).toBe(false)
  })

  it('strictly rejects inverted bounding box coordinates', () => {
    const valid = getCityConfig('amritsar')
    const inverted = {
      ...valid,
      bbox: [75.0, 32.0, 74.0, 31.0] as [number, number, number, number],
    }
    const result = cityConfigSchema.safeParse(inverted)
    expect(result.success).toBe(false)
  })

  it('detects tampering and throws when configHash does not match recomputed hash', () => {
    const valid = getCityConfig('jalandhar')
    const tampered = {
      ...valid,
      displayThreshold: 0.99, // Modifies hashed subset
    }
    expect(() => verifyConfigIntegrity(tampered)).toThrowError(/CONFIGURATION INTEGRITY ERROR/)
  })
})

describe('P23 — City Readiness State Machine', () => {
  it('evaluates Amritsar as evaluation_ready with ground-truth evidence', () => {
    const readiness = evaluateCityReadiness('amritsar')
    expect(readiness.cityId).toBe('amritsar')
    expect(readiness.determinedState).toBe('evaluation_ready')
    expect(readiness.declaredState).toBe('evaluation_ready')
    expect(readiness.isStateConsistent).toBe(true)

    const incidentCheck = readiness.checks.find((c) => c.id === 'incident_evidence')
    expect(incidentCheck?.passed).toBe(true)
  })

  it('evaluates Jalandhar as evidence_insufficient due to lack of verified historical storms', () => {
    const readiness = evaluateCityReadiness('jalandhar')
    expect(readiness.cityId).toBe('jalandhar')
    expect(readiness.determinedState).toBe('evidence_insufficient')
    expect(readiness.declaredState).toBe('evidence_insufficient')
    expect(readiness.isStateConsistent).toBe(true)

    const incidentCheck = readiness.checks.find((c) => c.id === 'incident_evidence')
    expect(incidentCheck?.passed).toBe(false)
    expect(incidentCheck?.message).toContain('No incidents_inventory.json found')
  })

  it('evaluates non-existent city as configuration_only', () => {
    const readiness = evaluateCityReadiness('patiala')
    expect(readiness.determinedState).toBe('configuration_only')
    expect(readiness.checks[0].passed).toBe(false)
  })
})

describe('P23 — Multi-City Alert Repository & Cross-City Isolation', () => {
  const repo = new FileAlertRepository()

  beforeEach(async () => {
    await repo.reset('jalandhar')
    await repo.reset('testcity')
  })

  it('isolates subscriber registrations between distinct cities', async () => {
    const now = new Date().toISOString()
    const subJalandhar: SubscriberPreference = {
      id: 'sub-jal-01',
      cityId: 'jalandhar',
      channel: 'email',
      destination: 'jalandhar_user@example.com',
      sensitivity: 'moderate_sensitivity',
      geofence: { type: 'corridor', roadCorridor: 'GT Road' },
      isOptedIn: true,
      isVerified: true,
      isTestSubscriber: true,
      consentTimestamp: now,
      createdAt: now,
      updatedAt: now,
    }

    const subTestCity: SubscriberPreference = {
      id: 'sub-tc-01',
      cityId: 'testcity',
      channel: 'email',
      destination: 'testcity_user@example.com',
      sensitivity: 'high_sensitivity',
      geofence: { type: 'citywide' },
      isOptedIn: true,
      isVerified: true,
      isTestSubscriber: true,
      consentTimestamp: now,
      createdAt: now,
      updatedAt: now,
    }

    await repo.saveSubscriber(subJalandhar)
    await repo.saveSubscriber(subTestCity)

    const jalSubs = await repo.getSubscribersByCity('jalandhar')
    const tcSubs = await repo.getSubscribersByCity('testcity')

    expect(jalSubs.map((s) => s.id)).toEqual(['sub-jal-01'])
    expect(tcSubs.map((s) => s.id)).toEqual(['sub-tc-01'])

    // Multi-city lookup by ID
    const foundJal = await repo.getSubscriberById('sub-jal-01')
    const foundTc = await repo.getSubscriberById('sub-tc-01')
    expect(foundJal?.cityId).toBe('jalandhar')
    expect(foundTc?.cityId).toBe('testcity')
  })

  it('routes deliveries strictly to the target city file and prevents cross-city leakage', async () => {
    const deliveryJal: DeliveryRecord = {
      deliveryId: 'del-jal-100',
      decisionId: 'DEC-JALANDHAR-100',
      subscriberId: 'sub-jal-01',
      destination: 'jalandhar_user@example.com',
      idempotencyKey: 'idem-jal-100',
      channel: 'email',
      status: 'delivered',
      attemptCount: 1,
      maxAttempts: 3,
      payload: {
        alertType: 'modeled_risk_alert',
        alertId: 'DEC-JALANDHAR-100',
        cityId: 'jalandhar',
        severity: 'elevated',
        maxRti: 0.85,
        thresholdApplied: 0.6,
        affectedAreaDescription: 'JALANDHAR Municipal Perimeter',
        affectedCellsCount: 12,
        evaluatedAt: new Date().toISOString(),
        weatherFreshnessNote: 'simulated',
        safetyGuidance: 'Slow down on arterial corridors in JALANDHAR.',
        disclaimer: 'NEXSTORM Modeled Risk Alert',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await repo.addDelivery(deliveryJal)

    // Lookup in repo
    const found = await repo.getDeliveryById('del-jal-100')
    expect(found).not.toBeNull()
    expect(found?.payload.cityId).toBe('jalandhar')

    // Resetting testcity does not erase Jalandhar deliveries
    await repo.reset('testcity')
    const stillThere = await repo.getDeliveryById('del-jal-100')
    expect(stillThere).not.toBeNull()

    // Resetting jalandhar erases it
    await repo.reset('jalandhar')
    const erased = await repo.getDeliveryById('del-jal-100')
    expect(erased).toBeNull()
  })
})

describe('P23 — Operational Dispatch Suppression & Readiness Safeguards', () => {
  const repo = new FileAlertRepository()

  beforeEach(async () => {
    await repo.reset('jalandhar')
    process.env.DISPATCH_ROLLOUT_MODE = 'test_mode'
  })

  it('suppresses outbound alert delivery for Jalandhar because readiness is evidence_insufficient', async () => {
    const now = new Date().toISOString()
    const subJalandhar: SubscriberPreference = {
      id: 'sub-jal-test',
      cityId: 'jalandhar',
      channel: 'email',
      destination: 'test_jal@example.com',
      sensitivity: 'high_sensitivity',
      geofence: { type: 'citywide' },
      isOptedIn: true,
      isVerified: true,
      isTestSubscriber: true,
      consentTimestamp: now,
      createdAt: now,
      updatedAt: now,
    }
    await repo.saveSubscriber(subJalandhar)

    const series = createScenarioRainfallSeries({
      cityId: 'jalandhar',
      peakMm1h: 45.0, // High rainfall to produce elevated risk
      durationH: 3,
    })

    const summary = await runAlertDispatch({
      cityId: 'jalandhar',
      series,
      forceTestProvider: true,
    })

    expect(summary.decision.cityId).toBe('jalandhar')
    expect(summary.totalSubscribersEvaluated).toBe(1)
    expect(summary.matchedSubscribers).toBe(1)
    expect(summary.suppressedDeliveries).toBe(1)
    expect(summary.successfulDeliveries).toBe(0)

    const record = summary.deliveries[0]
    expect(record.status).toBe('suppressed')
    expect(record.failureReason).toContain("City 'jalandhar' readiness state is 'evidence_insufficient'")
  })
})

describe('P23 — Weather Adapter Localization & Preflight Gates', () => {
  it('correctly formats local date with toCityDateString and retains toAmritsarDateString alias', () => {
    const isoUtcEvening = '2024-07-15T20:30:00Z'
    // 20:30 UTC + 05:30 IST = next morning 02:00 IST on 2024-07-16
    expect(toCityDateString(isoUtcEvening)).toBe('2024-07-16')
    expect(toAmritsarDateString(isoUtcEvening)).toBe('2024-07-16')
  })

  it('passes deployment preflight for evaluation_only mode with informative warning for secondary city', async () => {
    const report = await runDeploymentPreflight('evaluation_only')
    expect(report.ready).toBe(true)

    const amrCheck = report.checks.find((c) => c.id === 'city_readiness_amritsar')
    const jalCheck = report.checks.find((c) => c.id === 'city_readiness_jalandhar')

    expect(amrCheck?.status).toBe('PASS')
    expect(jalCheck?.status).toBe('WARN')
  })

  it('fails closed when attempting limited_rollout on a secondary city with insufficient evidence', async () => {
    const report = await runDeploymentPreflight('limited_rollout', 'jalandhar')
    expect(report.ready).toBe(false)

    const jalCheck = report.checks.find((c) => c.id === 'city_readiness_jalandhar')
    expect(jalCheck?.status).toBe('FAIL')
    expect(jalCheck?.message).toContain("City 'jalandhar' is in 'evidence_insufficient' readiness state")
  })
})
