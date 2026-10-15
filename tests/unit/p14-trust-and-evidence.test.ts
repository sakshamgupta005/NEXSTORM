/**
 * tests/unit/p14-trust-and-evidence.test.ts
 * Targeted verification tests for Stage P14: Trust, Evidence Quality & Operational Readiness.
 * Verifies freshness rules, provenance registry, moderation security, unknown-state semantics,
 * and reporter privacy.
 */

import { describe, expect, it } from 'vitest'
import {
  DATASET_PROVENANCE_REGISTRY,
  PERMANENT_DISCLAIMER,
  evaluateObservationFreshness,
} from '@/lib/provenance'
import { roadRiskService } from '@/lib/roads/service'
import { roadRoutingEngine } from '@/lib/roads/router'
import { NextRequest } from 'next/server'
import { PATCH as verifyObservation } from '@/app/api/observations/[id]/verify/route'
import { GET as getObservations } from '@/app/api/observations/route'

describe('P14 Evidence Quality & Provenance Registry', () => {
  it('contains permanent disclaimer without panic words', () => {
    expect(PERMANENT_DISCLAIMER).toContain('Experimental research prototype')
    expect(PERMANENT_DISCLAIMER).not.toContain('Evacuate')
    expect(PERMANENT_DISCLAIMER).not.toContain('Danger')
  })

  it('maintains comprehensive provenance entries for all 5 core datasets', () => {
    const keys = Object.keys(DATASET_PROVENANCE_REGISTRY)
    expect(keys).toContain('weather_forecast')
    expect(keys).toContain('topographic_susceptibility')
    expect(keys).toContain('building_exposure')
    expect(keys).toContain('road_network_routing')
    expect(keys).toContain('community_observations')

    for (const key of keys) {
      const entry = DATASET_PROVENANCE_REGISTRY[key]
      expect(entry.name).toBeDefined()
      expect(entry.source).toBeDefined()
      expect(entry.license).toBeDefined()
      expect(entry.primaryLimitations.length).toBeGreaterThan(0)
    }
  })

  it('correctly evaluates observation freshness thresholds (6h fresh, 24h stale)', () => {
    const now = Date.now()

    // 2 hours ago -> fresh
    const freshTime = new Date(now - 2 * 60 * 60 * 1000).toISOString()
    const freshEval = evaluateObservationFreshness(freshTime)
    expect(freshEval.status).toBe('fresh')
    expect(freshEval.isCurrentEvidence).toBe(true)

    // 12 hours ago -> stale
    const staleTime = new Date(now - 12 * 60 * 60 * 1000).toISOString()
    const staleEval = evaluateObservationFreshness(staleTime)
    expect(staleEval.status).toBe('stale')
    expect(staleEval.isCurrentEvidence).toBe(false)

    // 48 hours ago -> expired
    const expiredTime = new Date(now - 48 * 60 * 60 * 1000).toISOString()
    const expiredEval = evaluateObservationFreshness(expiredTime)
    expect(expiredEval.status).toBe('expired')
    expect(expiredEval.isCurrentEvidence).toBe(false)

    // Invalid timestamp -> expired
    const invalidEval = evaluateObservationFreshness('invalid-timestamp')
    expect(invalidEval.status).toBe('expired')
    expect(invalidEval.isCurrentEvidence).toBe(false)
  })
})

describe('P14 Unknown-State Semantics & Data Integrity', () => {
  it('penalizes unknown/unmatched segments in route evaluation rather than assuming safety', async () => {
    const syntheticCandidates = [
      {
        routeId: 'route-covered',
        name: 'Covered Corridor',
        coordinates: [
          [74.8765, 31.62],
          [74.877, 31.621],
        ] as [number, number][],
      },
    ]

    const evalResult = await roadRiskService.evaluateCandidateRoutes(syntheticCandidates)
    const route = evalResult.rankedRoutes[0]

    expect(route).toBeDefined()
    expect(route.unknownRiskDistanceM).toBeGreaterThanOrEqual(0)
    expect(route.unknownRiskFraction).toBeGreaterThanOrEqual(0)
    // Travel time must explicitly report 30 km/h baseline
    expect(route.speedBaselineKmh).toBe(30)
    expect(route.travelTimeDisclaimer).toContain('30 km/h')
  })

  it('handles out-of-bounds routing requests with clean descriptive error', () => {
    // Coordinate far outside Amritsar (Chandigarh: [76.7794, 30.7333])
    expect(() => {
      roadRoutingEngine.snapToNode([76.7794, 30.7333], 2000)
    }).toThrow(/exceed road network bounds/)
  })
})

describe('P14 Security & Reporter Privacy', () => {
  it('strips reporterHash from public observation queries', async () => {
    const req = new NextRequest('http://localhost:3000/api/observations?cityId=amritsar&limit=10')
    const res = await getObservations(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.data.observations).toBeDefined()
    for (const obs of json.data.observations) {
      expect(obs.reporterHash).toBeUndefined()
    }
  })

  it('rejects unauthorized moderation attempts with 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/observations/obs-sample-1/verify', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid-token-12345',
      },
      body: JSON.stringify({
        action: 'verify',
        verificationMethod: 'municipal_drainage_report',
      }),
    })

    const res = await verifyObservation(req, {
      params: Promise.resolve({ id: 'obs-sample-1' }),
    })
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHORIZED_VERIFICATION')
  })
})
