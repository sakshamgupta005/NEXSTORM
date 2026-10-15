/**
 * tests/unit/buildings/building-api.test.ts
 * API integration tests for GET /api/buildings endpoint.
 */

import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as getBuildings } from '@/app/api/buildings/route'

describe('Building Exposure API Endpoints', () => {
  describe('GET /api/buildings', () => {
    it('returns 200 with list of building exposure records for Amritsar', async () => {
      const req = new NextRequest('http://localhost:3000/api/buildings?cityId=amritsar&limit=10')
      const res = await getBuildings(req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.cityId).toBe('amritsar')
      expect(body.data.items.length).toBeLessThanOrEqual(10)
      expect(body.data.total).toBeGreaterThan(0)
      expect(body.data.items[0].buildingId).toBeDefined()
      expect(body.data.provenance.sourceName).toContain('Google Open Buildings V3')
    })

    it('rejects unsupported city with 404', async () => {
      const req = new NextRequest('http://localhost:3000/api/buildings?cityId=jalandhar')
      const res = await getBuildings(req)
      expect(res.status).toBe(404)

      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.message).toContain('only prepared for Amritsar')
    })

    it('supports bounding-box viewport queries', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/buildings?cityId=amritsar&bbox=74.86,31.62,74.88,31.64&limit=5'
      )
      const res = await getBuildings(req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data.items.length).toBeGreaterThan(0)
      expect(body.data.items.length).toBeLessThanOrEqual(5)
    })

    it('filters by exposure category', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/buildings?cityId=amritsar&exposureCategory=high_catchment&limit=5'
      )
      const res = await getBuildings(req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.data.items.length).toBeGreaterThan(0)
      for (const item of body.data.items) {
        expect(item.exposureCategory).toBe('high_catchment')
      }
    })
  })
})
