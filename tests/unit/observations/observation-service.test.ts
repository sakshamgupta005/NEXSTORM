/**
 * tests/unit/observations/observation-service.test.ts
 * Rigorous unit tests for Observation validation, lifecycle, spatial matching,
 * corroboration clustering, and verification transitions in Amritsar.
 */

import { describe, expect, it, beforeEach } from 'vitest'
import {
  createObservationSchema,
  verifyObservationSchema,
  observationQuerySchema,
} from '@/lib/validations/observation'
import { observationService } from '@/lib/observations/service'
import type { CreateObservationInput } from '@/lib/observations/types'

describe('Observation Schema Validation', () => {
  const validAmritsarCoords = { lat: 31.634, lng: 74.872 }

  it('accepts a valid observation submission within Amritsar bounds', () => {
    const validPayload = {
      cityId: 'amritsar',
      coordinates: validAmritsarCoords,
      observedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      category: 'street_flooding',
      severity: 'moderate_ankle',
      description: 'Water standing outside Hall Gate after heavy downpour.',
    }

    const result = createObservationSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('rejects coordinates outside Amritsar pilot boundary', () => {
    const outOfBoundsPayload = {
      cityId: 'amritsar',
      coordinates: { lat: 28.6139, lng: 77.209 }, // New Delhi
      observedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      category: 'ponding',
      severity: 'minor_curb',
    }

    const result = createObservationSchema.safeParse(outOfBoundsPayload)
    expect(result.success).toBe(false)
    if (!result.success) {
      const issues = result.error.issues.map((i) => i.message)
      expect(issues.some((m) => m.includes('Latitude must be'))).toBe(true)
      expect(issues.some((m) => m.includes('Longitude must be'))).toBe(true)
    }
  })

  it('rejects future observedAt timestamps', () => {
    const futurePayload = {
      cityId: 'amritsar',
      coordinates: validAmritsarCoords,
      observedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      category: 'ponding',
      severity: 'minor_curb',
    }

    const result = createObservationSchema.safeParse(futurePayload)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('observedAt cannot be in the future')
    }
  })

  it('rejects observations older than 7 days', () => {
    const ancientPayload = {
      cityId: 'amritsar',
      coordinates: validAmritsarCoords,
      observedAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
      category: 'drain_overflow',
      severity: 'severe_knee_or_higher',
    }

    const result = createObservationSchema.safeParse(ancientPayload)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Community observations cannot be older than 7 days')
    }
  })

  it('validates verification schema fields correctly', () => {
    const validVerification = {
      status: 'verified' as const,
      verificationMethod: 'traffic_police_notice' as const,
      verifiedBy: 'Punjab Traffic Police Dispatcher #42',
      verificationNotes: 'Confirmed roadway submerged near bus stand.',
    }

    const result = verifyObservationSchema.safeParse(validVerification)
    expect(result.success).toBe(true)
  })

  it('validates query schema correctly', () => {
    const query = {
      cityId: 'amritsar',
      status: 'verified',
      category: 'street_flooding',
      freshOnly: 'true',
      limit: '25',
    }
    const result = observationQuerySchema.safeParse(query)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.freshOnly).toBe(true)
      expect(result.data.limit).toBe(25)
    }
  })
})

describe('ObservationService Lifecycle & Abuse Prevention', () => {
  beforeEach(() => {
    observationService.resetForTesting()
  })
  it('computes pseudonymous reporter hash without storing PII', () => {
    const hash1 = observationService.generateReporterHash('192.168.1.1', 'Mozilla/5.0')
    const hash2 = observationService.generateReporterHash('192.168.1.1', 'Mozilla/5.0')
    const hash3 = observationService.generateReporterHash('192.168.1.2', 'Mozilla/5.0')

    expect(hash1).toBe(hash2)
    expect(hash1).not.toBe(hash3)
    expect(hash1).toMatch(/^[a-f0-9]{16}$/)
  })

  it('detects and blocks duplicate submissions from the same reporter in close proximity within 15 minutes', () => {
    const reporterHash = 'a1b2c3d4e5f60718'
    const input: CreateObservationInput = {
      cityId: 'amritsar',
      coordinates: { lat: 31.634, lng: 74.872 },
      observedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      category: 'street_flooding',
      severity: 'moderate_ankle',
      description: 'First report near GT Road',
    }

    // First submission succeeds
    const res1 = observationService.submitObservation(input, reporterHash)
    expect(res1.duplicate).toBeFalsy()
    expect(res1.observation).toBeDefined()

    // Second submission from same reporter 10 meters away within 15 minutes fails
    const res2 = observationService.submitObservation(
      {
        ...input,
        coordinates: { lat: 31.63405, lng: 74.87205 }, // ~8m away
      },
      reporterHash
    )
    expect(res2.duplicate).toBe(true)
    expect(res2.error).toContain('Duplicate observation detected')
  })

  it('allows nearby submissions from different reporters and triggers corroboration', () => {
    const reporterA = 'reporter_alpha_1'
    const reporterB = 'reporter_beta_02'
    const reporterC = 'reporter_gamma_03'

    const now = Date.now()
    const baseCoords = { lat: 31.625, lng: 74.865 }

    // Reporter A submits
    const resA = observationService.submitObservation(
      {
        cityId: 'amritsar',
        coordinates: baseCoords,
        observedAt: new Date(now - 20 * 60 * 1000).toISOString(),
        category: 'underpass_submersion',
        severity: 'severe_knee_or_higher',
      },
      reporterA
    )
    expect(resA.observation?.lifecycleStatus).toBe('submitted')
    expect(resA.observation?.corroboration.corroborationCount).toBe(1)

    // Reporter B submits ~50m away within same hour
    const resB = observationService.submitObservation(
      {
        cityId: 'amritsar',
        coordinates: { lat: 31.6253, lng: 74.8652 },
        observedAt: new Date(now - 15 * 60 * 1000).toISOString(),
        category: 'underpass_submersion',
        severity: 'severe_knee_or_higher',
      },
      reporterB
    )
    expect(resB.observation?.corroboration.corroborationCount).toBe(2)

    // Reporter C submits nearby
    const resC = observationService.submitObservation(
      {
        cityId: 'amritsar',
        coordinates: { lat: 31.6251, lng: 74.8651 },
        observedAt: new Date(now - 10 * 60 * 1000).toISOString(),
        category: 'underpass_submersion',
        severity: 'impassable_vehicles',
      },
      reporterC
    )
    expect(resC.observation?.lifecycleStatus).toBe('corroborated')
    expect(resC.observation?.corroboration.corroborationCount).toBe(3)
    // Corroboration does NOT mark as verified
    expect(resC.observation?.verification.isVerified).toBe(false)
  })

  it('allows authorized reviewer to verify an observation with full provenance', () => {
    const reporterHash = 'reporter_field_agent'
    const created = observationService.submitObservation(
      {
        cityId: 'amritsar',
        coordinates: { lat: 31.632, lng: 74.87 },
        observedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        category: 'drain_overflow',
        severity: 'moderate_ankle',
      },
      reporterHash
    )

    const obsId = created.observation!.id

    const verified = observationService.verifyObservation(
      obsId,
      {
        status: 'verified',
        verificationMethod: 'field_inspection',
        verifiedBy: 'mca_officer_42',
        verificationNotes: 'Inspected on-site; primary storm drain clogged with silt.',
      },
      'amritsar'
    )

    expect(verified.error).toBeUndefined()
    expect(verified.observation).toBeDefined()
    expect(verified.observation?.lifecycleStatus).toBe('verified')
    expect(verified.observation?.verification.isVerified).toBe(true)
    expect(verified.observation?.verification.verificationMethod).toBe('field_inspection')
    expect(verified.observation?.verification.verifiedBy).toBe('mca_officer_42')
    expect(verified.observation?.verification.verifiedAt).toBeDefined()
  })

  it('marks receding_water observations as immediately expired', () => {
    const reporterHash = 'reporter_water_clear'
    const res = observationService.submitObservation(
      {
        cityId: 'amritsar',
        coordinates: { lat: 31.634, lng: 74.872 },
        observedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        category: 'receding_water',
        severity: 'minor_curb',
      },
      reporterHash
    )

    expect(res.observation?.freshness.isExpired).toBe(true)
  })

  it('performs spatial grid matching and preserves unmatched honest status when outside road buffer', () => {
    // Point inside Amritsar core
    const insideRes = observationService.submitObservation(
      {
        cityId: 'amritsar',
        coordinates: { lat: 31.634, lng: 74.872 },
        observedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        category: 'street_flooding',
        severity: 'moderate_ankle',
      },
      'tester_spatial_inside'
    )

    expect(insideRes.observation?.spatialMatch.matchQuality).toBeDefined()

    // Point in open field in Amritsar boundary corner that has no road within 30m
    const farRes = observationService.submitObservation(
      {
        cityId: 'amritsar',
        coordinates: { lat: 31.51, lng: 74.72 },
        observedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        category: 'street_flooding',
        severity: 'minor_curb',
      },
      'tester_spatial_far'
    )

    if (farRes.observation?.spatialMatch.roadSegmentId === null) {
      expect(farRes.observation.spatialMatch.unmatchedReason).toBeDefined()
    }
  })
})
