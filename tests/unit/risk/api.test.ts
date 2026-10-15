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
      expect(json.data.cells.length).toBeGreaterThan(1000)
    })

    it('supports view=campus returning 699 GNDU sub-grid cells', async () => {
      const url =
        'http://localhost:3000/api/risk?cityId=amritsar&view=campus&mode=scenario&peakMm1h=40&durationH=4'
      const req = new NextRequest(url, { method: 'GET' })

      const res = await handleRiskGet(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.view).toBe('campus')
      expect(json.data.cells.length).toBe(699)
      expect(json.data.cells[0].id).toBe('G-0001')
    })

    it('processes live mode using weather adapter without crashing', async () => {
      const url = 'http://localhost:3000/api/risk?cityId=amritsar&mode=live'
      const req = new NextRequest(url, { method: 'GET' })

      const res = await handleRiskGet(req)
      // If network is offline and no snapshot exists, 503 DEGRADED_NO_SNAPSHOT, else 200 OK
      expect([200, 503]).toContain(res.status)
      const json = await res.json()
      if (res.status === 200) {
        expect(json.success).toBe(true)
        expect(json.data.mode).toBe('live')
        expect(json.data.timeline.length).toBeGreaterThan(0)
      } else {
        expect(json.success).toBe(false)
        expect(json.error.code).toBe('DEGRADED_NO_SNAPSHOT')
      }
    })

    it('processes replay mode with correct provenance and confidence', async () => {
      const url = 'http://localhost:3000/api/risk?cityId=amritsar&mode=replay&event=2025-09-01_amritsar&t=0'
      const req = new NextRequest(url, { method: 'GET' })

      const res = await handleRiskGet(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.mode).toBe('replay')
      expect(json.data.selectedHour.confidence).toBe('unavailable')
    })

    it('returns HTTP 400 for invalid mode parameter', async () => {
      const url = 'http://localhost:3000/api/risk?cityId=amritsar&mode=invalid_mode'
      const req = new NextRequest(url, { method: 'GET' })

      const res = await handleRiskGet(req)
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('INVALID_MODE')
    })

    it('returns HTTP 400 for path traversal in event parameter', async () => {
      const url = 'http://localhost:3000/api/risk?cityId=amritsar&mode=replay&event=../../etc/passwd'
      const req = new NextRequest(url, { method: 'GET' })

      const res = await handleRiskGet(req)
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('INVALID_EVENT_PARAM')
    })
  })
})

