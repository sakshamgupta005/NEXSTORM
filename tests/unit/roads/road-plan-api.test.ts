/**
 * tests/unit/roads/road-plan-api.test.ts
 * API tests for POST and GET /api/roads/plan.
 */

import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/roads/plan/route'

describe('Route Plan API - POST /api/roads/plan', () => {
  it('returns 200 and candidate routes for valid Amritsar endpoints', async () => {
    const payload = {
      cityId: 'amritsar',
      origin: [74.8765, 31.62], // Golden Temple
      destination: [74.8655, 31.634], // Railway Station
      originName: 'Golden Temple',
      destinationName: 'Railway Station',
    }

    const req = new NextRequest('http://localhost:3000/api/roads/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.cityId).toBe('amritsar')
    expect(json.data.routes.length).toBeGreaterThanOrEqual(1)
    expect(json.data.origin.snappedNodeId).toBeDefined()
    expect(json.data.destination.snappedNodeId).toBeDefined()
    expect(json.provenance.source).toContain('NEXSTORM Road Risk & Flood-Aware Router P13')
    expect(json.data.speedAssumptionNotice).toContain('30 km/h')
  })

  it('rejects unsupported cityId with 404', async () => {
    const payload = {
      cityId: 'ludhiana',
      origin: [74.8765, 31.62],
      destination: [74.8655, 31.634],
    }

    const req = new NextRequest('http://localhost:3000/api/roads/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const res = await POST(req)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toContain('only available for Amritsar')
  })

  it('rejects invalid coordinates with 400', async () => {
    const payload = {
      cityId: 'amritsar',
      origin: [10.0, 20.0], // Way outside Punjab
      destination: [74.8655, 31.634],
    }

    const req = new NextRequest('http://localhost:3000/api/roads/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects identical endpoints with 422', async () => {
    const payload = {
      cityId: 'amritsar',
      origin: [74.8765, 31.62],
      destination: [74.8765, 31.62],
    }

    const req = new NextRequest('http://localhost:3000/api/roads/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const res = await POST(req)
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.error).toContain('same road network node')
  })
})

describe('Route Plan API - GET /api/roads/plan', () => {
  it('returns 200 via GET query parameters', async () => {
    const url =
      'http://localhost:3000/api/roads/plan?originLng=74.881&originLat=31.641&destLng=74.898&destLat=31.645&cityId=amritsar'
    const req = new NextRequest(url)
    const res = await GET(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.data.routes.length).toBeGreaterThanOrEqual(1)
    expect(json.data.routes[0].totalDistanceMeters).toBeGreaterThan(0)
  })
})
