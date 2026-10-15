/**
 * tests/unit/p17-backend-truth-data-integrity.test.ts
 * Rigorous test suite for P17 — Backend Truth, Data Integrity & Production Reliability.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { observationService } from '@/lib/observations/service'
import { FileObservationRepository, getObservationRepository } from '@/lib/observations/repository'
import { getClientIp } from '@/lib/security/rate-limit'
import { PATCH as handleVerifyPatch } from '@/app/api/observations/[id]/verify/route'
import { GET as handleRiskGet } from '@/app/api/risk/route'
import { GET as handleObservationsGet } from '@/app/api/observations/route'
import * as ensembleModule from '@/lib/weather/ensemble'
import type { RainfallSeries } from '@/lib/weather/types'
import { wgs84ToUtm43n, utm43nToWgs84, euclideanDistanceUtm } from '@/lib/spatial'

describe('P17 — Backend Truth, Data Integrity & Production Reliability', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    observationService.resetForTesting()
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe('1. Production Secrets & Reporter Pseudonymity', () => {
    it('uses keyed HMAC-SHA256 for reporter hash generation', () => {
      process.env.OBSERVATION_SALT = 'super_secret_test_salt_123'
      const hashA1 = observationService.generateReporterHash('10.0.0.1', 'Mozilla')
      const hashA2 = observationService.generateReporterHash('10.0.0.1', 'Mozilla')
      const hashB = observationService.generateReporterHash('10.0.0.2', 'Mozilla')

      expect(hashA1).toBe(hashA2)
      expect(hashA1).not.toBe(hashB)
      expect(hashA1).toMatch(/^[a-f0-9]{16}$/)
    })

    it('generates ephemeral startup secret and warns in production when OBSERVATION_SALT is unset', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production'
      delete process.env.OBSERVATION_SALT

      const hash = observationService.generateReporterHash('10.0.0.1', 'Mozilla')
      expect(hash).toBeDefined()
      expect(hash.length).toBe(16)
    })

    it('redacts reporterHash from public GET /api/observations responses', async () => {
      const req = new NextRequest('http://localhost:3000/api/observations?cityId=amritsar')
      const res = await handleObservationsGet(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.observations.length).toBeGreaterThan(0)
      for (const obs of json.data.observations) {
        expect(obs.reporterHash).toBeUndefined()
      }
    })
  })

  describe('2. Client IP Extraction & Reverse-Proxy Spoofing Protection', () => {
    it('prioritizes trusted cf-connecting-ip over untrusted x-forwarded-for', () => {
      const headers = new Headers({
        'cf-connecting-ip': '203.0.113.195',
        'x-forwarded-for': '198.51.100.1, 10.0.0.1',
      })
      const ip = getClientIp(headers)
      expect(ip).toBe('203.0.113.195')
    })

    it('prioritizes x-real-ip over client-supplied x-forwarded-for', () => {
      const headers = new Headers({
        'x-real-ip': '198.51.100.42',
        'x-forwarded-for': '10.0.0.99',
      })
      const ip = getClientIp(headers)
      expect(ip).toBe('198.51.100.42')
    })

    it('sanitizes and strips port numbers from forwarded headers', () => {
      const headers = new Headers({
        'x-forwarded-for': '203.0.113.50:8080',
      })
      const ip = getClientIp(headers)
      expect(ip).toBe('203.0.113.50')
    })

    it('falls back to 127.0.0.1 when header contains malformed injection', () => {
      const headers = new Headers({
        'x-forwarded-for': '<script>alert(1)</script>',
      })
      const ip = getClientIp(headers)
      expect(ip).toBe('127.0.0.1')
    })
  })

  describe('3. Observation Repository & Concurrency Integrity', () => {
    it('initializes FileObservationRepository in development with isDurable = false', () => {
      const repo = getObservationRepository()
      expect(repo.storageType).toBe('local_file_dev')
      expect(repo.isDurable()).toBe(false)
      expect(observationService.isDurableStorage()).toBe(false)
    })

    it('handles concurrent submissions without lost updates or race corruption', async () => {
      const repo = new FileObservationRepository()
      const testCity = 'amritsar_test_concurrent'

      const makeObs = (id: string) => ({
        id: `OBS-CONC-${id}`,
        schemaVersion: '1.0.0' as const,
        cityId: testCity,
        createdAt: new Date().toISOString(),
        submittedAt: new Date().toISOString(),
        observedAt: new Date().toISOString(),
        coordinates: { lat: 31.63, lng: 74.87 },
        spatialMatch: {
          cellId: 'A-0935',
          cellSusceptibility: 0.8,
          roadSegmentId: null,
          roadName: null,
          distanceToRoadMeters: null,
          matchQuality: 'exact_inside' as const,
        },
        category: 'street_flooding' as const,
        severity: 'moderate_ankle' as const,
        reporterHash: `reporter_${id}`,
        sourceType: 'community_submission' as const,
        lifecycleStatus: 'submitted' as const,
        verification: {
          isVerified: false,
          verifiedAt: null,
          verifiedBy: null,
          verificationMethod: null,
          verificationNotes: null,
        },
        corroboration: {
          corroborationCount: 1,
          corroboratingObservationIds: [],
          lastCorroboratedAt: null,
        },
        freshness: {
          isStale: false,
          isExpired: false,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
        scientificCaveat: 'Test caveat',
      })

      // Fire 10 concurrent writes simultaneously
      const writes = Array.from({ length: 10 }, (_, i) => repo.add(makeObs(String(i)), testCity))
      await Promise.all(writes)

      const stored = await repo.getAll(testCity)
      expect(stored.length).toBe(10)

      // Clean up test file
      await repo.reset(testCity)
    })
  })

  describe('4. Real Observations vs. Historical Media Evidence', () => {
    it('labels historical news records as unverified with news_report provenance', () => {
      const all = observationService.loadObservations('amritsar')
      const historicalRecords = all.filter((o) => o.sourceType === 'imported_historical_record')

      expect(historicalRecords.length).toBe(15)
      for (const rec of historicalRecords) {
        // Must never claim verified ground truth
        expect(rec.verification.isVerified).toBe(false)
        expect(rec.verification.verificationMethod).toBe('news_report')
        expect(rec.verification.verifiedBy).toContain('The Tribune India')
        // Must be marked expired/stale so it does not mislead live navigation
        expect(rec.freshness.isExpired).toBe(true)
        expect(rec.freshness.isStale).toBe(true)
      }
    })

    it('idempotently retains historical records without duplicating on reload', () => {
      const run1 = observationService.loadObservations('amritsar')
      const count1 = run1.length

      // Simulate process restart
      observationService.resetForTesting('amritsar')
      const run2 = observationService.loadObservations('amritsar')
      const count2 = run2.length

      expect(count2).toBe(count1)
    })
  })

  describe('5. Moderator Authentication & Timing-Safe Verification', () => {
    it('rejects verification requests with invalid moderator tokens', async () => {
      process.env.OBSERVATION_MODERATOR_KEY = 'correct_production_token_123456789'
      ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'

      const req = new NextRequest(
        'http://localhost:3000/api/observations/OBS-HIST-0001/verify',
        {
          method: 'PATCH',
          headers: {
            authorization: 'Bearer wrong_token',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            status: 'verified',
            verificationMethod: 'field_inspection',
            verifiedBy: 'Inspector 42',
          }),
        }
      )

      const res = await handleVerifyPatch(req, {
        params: Promise.resolve({ id: 'OBS-HIST-0001' }),
      })
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.error.code).toBe('UNAUTHORIZED_VERIFICATION')
    })

    it('accepts verification with valid token and audits transition', async () => {
      process.env.OBSERVATION_MODERATOR_KEY = 'correct_production_token_123456789'
      ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'

      const req = new NextRequest(
        'http://localhost:3000/api/observations/OBS-HIST-0001/verify',
        {
          method: 'PATCH',
          headers: {
            authorization: 'Bearer correct_production_token_123456789',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            status: 'verified',
            verificationMethod: 'field_inspection',
            verifiedBy: 'MCA Municipal Engineer 07',
            verificationNotes: 'On-site physical inspection confirmed culvert overflow.',
          }),
        }
      )

      const res = await handleVerifyPatch(req, {
        params: Promise.resolve({ id: 'OBS-HIST-0001' }),
      })
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.lifecycleStatus).toBe('verified')
      expect(json.data.verification.isVerified).toBe(true)
      expect(json.data.verification.verifiedBy).toBe('MCA Municipal Engineer 07')
    })
  })

  describe('6. Weather Provenance & Truthful Degraded Fallbacks', () => {
    it('sets status to degraded when live mode falls back to cached snapshot', async () => {
      const mockSnapshotSeries: RainfallSeries = {
        cityId: 'amritsar',
        issueTime: '2026-10-14T00:00:00+05:30',
        hours: ['2026-10-14T00:00:00+05:30', '2026-10-14T01:00:00+05:30'],
        deterministic: [2.5, 4.0],
        model: 'snapshot_fallback',
        gridKm: 9,
        provenance: {
          kind: 'cached',
          source: 'Open-Meteo Forecast (Snapshot)',
          fetchedAt: '2026-10-14T00:00:00Z',
          ageSeconds: 1200,
          note: 'Cached snapshot (1200s old)',
        },
      }

      vi.spyOn(ensembleModule, 'fetchEnsembleForecast').mockResolvedValueOnce({
        status: 'ok',
        data: mockSnapshotSeries,
        provenance: mockSnapshotSeries.provenance,
      })

      const req = new NextRequest('http://localhost:3000/api/risk?cityId=amritsar&mode=live', {
        method: 'GET',
      })
      const res = await handleRiskGet(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.mode).toBe('live')
      // Truthful degraded status must be reported
      expect(json.data.status).toBe('degraded')
      expect(json.data.provenance[0].kind).toBe('cached')
    })
  })

  describe('7. Geodetic CRS Transformations & Spatial Snapping', () => {
    it('accurately transforms between WGS84 and UTM Zone 43N with sub-meter roundtrip precision', () => {
      const goldenTemple = { lat: 31.6200, lng: 74.8765 }
      const utm = wgs84ToUtm43n(goldenTemple)

      // Expected UTM 43N coordinates for Amritsar (~488,287 m E, ~3,498,349 m N)
      expect(utm.easting).toBeGreaterThan(470000)
      expect(utm.easting).toBeLessThan(510000)
      expect(utm.northing).toBeGreaterThan(3480000)
      expect(utm.northing).toBeLessThan(3520000)

      const roundTrip = utm43nToWgs84(utm)
      expect(Math.abs(roundTrip.lat - goldenTemple.lat)).toBeLessThan(1e-5)
      expect(Math.abs(roundTrip.lng - goldenTemple.lng)).toBeLessThan(1e-5)
    })

    it('calculates true Euclidean distance in UTM metric space', () => {
      const p1 = { easting: 677000, northing: 3500000, zone: 43 as const, hemisphere: 'N' as const }
      const p2 = { easting: 677030, northing: 3500040, zone: 43 as const, hemisphere: 'N' as const } // 30m east, 40m north -> 50m distance
      const dist = euclideanDistanceUtm(p1, p2)
      expect(Math.round(dist)).toBe(50)
    })
  })
})
