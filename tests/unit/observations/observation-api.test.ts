/**
 * tests/unit/observations/observation-api.test.ts
 * Tests for GET/POST /api/observations and PATCH /api/observations/[id]/verify
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/observations/route'
import { PATCH } from '@/app/api/observations/[id]/verify/route'
import { observationService } from '@/lib/observations/service'

describe('Observation API Endpoints', () => {
  beforeEach(() => {
    observationService.resetForTesting()
  })

  describe('GET /api/observations', () => {
    it('returns 200 with list of observations for Amritsar', async () => {
      const req = new NextRequest('http://localhost:3000/api/observations?cityId=amritsar')
      const res = await GET(req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data.observations)).toBe(true)
      expect(body.data.cityId).toBe('amritsar')
      expect(body.data.totalCount).toBeGreaterThanOrEqual(15) // seeded from Tribune hotspots
    })

    it('rejects unsupported city with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/observations?cityId=delhi')
      const res = await GET(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('UNSUPPORTED_CITY')
    })

    it('filters by status and severity', async () => {
      const req = new NextRequest('http://localhost:3000/api/observations?cityId=amritsar&status=verified&limit=5')
      const res = await GET(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.observations.length).toBeLessThanOrEqual(5)
      for (const obs of body.data.observations) {
        expect(obs.lifecycleStatus).toBe('verified')
      }
    })
  })

  describe('POST /api/observations', () => {
    it('successfully submits a valid community observation', async () => {
      const validPayload = {
        cityId: 'amritsar',
        coordinates: { lat: 31.634, lng: 74.872 },
        observedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        category: 'street_flooding',
        severity: 'moderate_ankle',
        description: 'Water standing outside Hall Gate.',
      }

      const req = new NextRequest('http://localhost:3000/api/observations', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '10.0.0.1',
          'user-agent': 'Vitest-Test-Agent/1.0',
        },
        body: JSON.stringify(validPayload),
      })

      const res = await POST(req)
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.id).toMatch(/^OBS-/)
      expect(body.data.lifecycleStatus).toBe('submitted')
      expect(body.data.spatialMatch).toBeDefined()
      expect(body.data.reporterHash).toBeUndefined() // Redacted in API response
    })

    it('rejects payload with invalid coordinates outside Amritsar with 400', async () => {
      const invalidPayload = {
        cityId: 'amritsar',
        coordinates: { lat: 28.0, lng: 77.0 },
        observedAt: new Date().toISOString(),
        category: 'street_flooding',
        severity: 'minor_curb',
      }

      const req = new NextRequest('http://localhost:3000/api/observations', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.0.0.2' },
        body: JSON.stringify(invalidPayload),
      })

      const res = await POST(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('PATCH /api/observations/[id]/verify', () => {
    it('rejects unauthorized requests missing moderator bearer token', async () => {
      const req = new NextRequest('http://localhost:3000/api/observations/OBS-HIST-0001/verify', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status: 'verified',
          verifiedBy: 'Officer',
          verificationMethod: 'field_inspection',
        }),
      })

      const res = await PATCH(req, { params: Promise.resolve({ id: 'OBS-HIST-0001' }) })
      expect(res.status).toBe(401)
    })

    it('allows authorized moderation with valid token', async () => {
      // First create a new submitted observation
      const created = observationService.submitObservation(
        {
          cityId: 'amritsar',
          coordinates: { lat: 31.632, lng: 74.87 },
          observedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
          category: 'drain_overflow',
          severity: 'moderate_ankle',
        },
        'test_rep_auth'
      )
      const obsId = created.observation!.id

      const req = new NextRequest(`http://localhost:3000/api/observations/${obsId}/verify`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer dev-reviewer',
        },
        body: JSON.stringify({
          status: 'verified',
          verifiedBy: 'Municipal Corporation Amritsar Ward 8 Inspector',
          verificationMethod: 'field_inspection',
          verificationNotes: 'On-site team confirmed blockage cleared.',
        }),
      })

      const res = await PATCH(req, { params: Promise.resolve({ id: obsId }) })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.lifecycleStatus).toBe('verified')
      expect(body.data.verification.isVerified).toBe(true)
      expect(body.data.verification.verificationMethod).toBe('field_inspection')
    })
  })
})
