import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as handleScenarioPost } from '@/app/api/scenario/route'
import { GET as handleRiskGet } from '@/app/api/risk/route'

describe('Scenario & Risk Route Handlers', () => {
  describe('POST /api/scenario', () => {
    it('returns HTTP 200 with complete scenario result for valid parameters', async () => {
      const req = new NextRequest('http://localhost:3000/api/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cityId: 'amritsar',
          peakMm1h: 30,
          durationH: 3,
          antecedentMm72h: 10,
        }),
      })

      const res = await handleScenarioPost(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.cells.length).toBeGreaterThan(1000)
      expect(json.data.rainfall.derived.maxMm1h).toBe(30)
      expect(json.data.provenance).toBeDefined()
    })

    it('returns HTTP 400 for out-of-range peak rainfall (> 120 mm)', async () => {
      const req = new NextRequest('http://localhost:3000/api/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cityId: 'amritsar',
          peakMm1h: 150, // exceeds 120
          durationH: 4,
          antecedentMm72h: 0,
        }),
      })

      const res = await handleScenarioPost(req)
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns HTTP 400 for unknown cityId without silent fallback', async () => {
      const req = new NextRequest('http://localhost:3000/api/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cityId: 'delhi',
          peakMm1h: 40,
          durationH: 3,
          antecedentMm72h: 0,
        }),
      })

      const res = await handleScenarioPost(req)
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('UNKNOWN_CITY')
      expect(json.error.message).toContain('Unknown city')
    })
  })

  describe('GET /api/risk', () => {
    it('supports scenario query params and returns HTTP 200', async () => {
      const url =
        'http://localhost:3000/api/risk?cityId=amritsar&mode=scenario&peakMm1h=40&durationH=4&antecedentMm72h=20'
      const req = new NextRequest(url, { method: 'GET' })

      const res = await handleRiskGet(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.rainfall.derived.maxMm1h).toBe(40)
    })

    it('returns HTTP 501 for unreleased live mode', async () => {
      const url = 'http://localhost:3000/api/risk?cityId=amritsar&mode=live'
      const req = new NextRequest(url, { method: 'GET' })

      const res = await handleRiskGet(req)
      expect(res.status).toBe(501)
      const json = await res.json()
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('NOT_IMPLEMENTED')
      expect(json.error.message).toContain('not yet implemented')
    })

    it('returns HTTP 501 for unreleased replay mode', async () => {
      const url = 'http://localhost:3000/api/risk?cityId=amritsar&mode=replay'
      const req = new NextRequest(url, { method: 'GET' })

      const res = await handleRiskGet(req)
      expect(res.status).toBe(501)
      const json = await res.json()
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('NOT_IMPLEMENTED')
    })
  })
})
