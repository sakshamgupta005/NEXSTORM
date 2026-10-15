/**
 * tests/unit/roads/road-api.test.ts
 * API integration tests for GET /api/roads/risk and POST /api/roads/route-compare.
 */

import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as getRoadRisk } from '@/app/api/roads/risk/route'
import { POST as postRouteCompare } from '@/app/api/roads/route-compare/route'

describe('Road Risk API Endpoints', () => {
  describe('GET /api/roads/risk', () => {
    it('returns 200 with road segments for Amritsar', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/roads/risk?cityId=amritsar&limit=10'
      )
      const res = await getRoadRisk(req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data.cityId).toBe('amritsar')
      expect(body.data.provenance).toBeDefined()
      expect(body.data.items.length).toBeLessThanOrEqual(10)
      expect(body.data.total).toBeGreaterThan(0)
      expect(body.data.items[0].segmentId).toBeDefined()
    })

    it('rejects unsupported city with 404', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/roads/risk?cityId=ludhiana'
      )
      const res = await getRoadRisk(req)
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error.message).toContain('only prepared for Amritsar')
    })

    it('supports bounding-box filtering', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/roads/risk?cityId=amritsar&bbox=74.85,31.62,74.88,31.65&limit=5'
      )
      const res = await getRoadRisk(req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data.items.length).toBeGreaterThan(0)
      expect(body.data.items.length).toBeLessThanOrEqual(5)
    })

    it('filters by underpass tags', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/roads/risk?cityId=amritsar&hasUnderpass=true'
      )
      const res = await getRoadRisk(req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data.items.length).toBeGreaterThan(0)
      for (const item of body.data.items) {
        expect(item.isUnderpass).toBe(true)
      }
    })
  })

  describe('POST /api/roads/route-compare', () => {
    it('successfully evaluates and ranks candidate routes', async () => {
      const payload = {
        cityId: 'amritsar',
        routes: [
          {
            routeId: 'route-a',
            name: 'GT Road Corridor',
            coordinates: [
              [74.838, 31.632],
              [74.851, 31.634],
              [74.868, 31.635],
            ],
          },
          {
            routeId: 'route-b',
            name: 'Railway Colony Chokepoint',
            coordinates: [
              [74.862, 31.621],
              [74.869, 31.627],
              [74.872, 31.631],
            ],
          },
        ],
      }

      const req = new Request('http://localhost:3000/api/roads/route-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const res = await postRouteCompare(req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.cityId).toBe('amritsar')
      expect(body.data.rankedRoutes.length).toBe(2)
      expect(body.data.safestRouteId).toBeDefined()
      expect(body.provenance.disclaimer).toContain('Not an operational routing engine')
    })

    it('rejects invalid request payload with 400', async () => {
      const invalidPayload = {
        cityId: 'amritsar',
        routes: [], // Empty routes array
      }

      const req = new Request('http://localhost:3000/api/roads/route-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload),
      })

      const res = await postRouteCompare(req)
      expect(res.status).toBe(400)
    })
  })
})
