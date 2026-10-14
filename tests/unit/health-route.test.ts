import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/health/route'
import { NextRequest } from 'next/server'

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 200 with status healthy and request ID', async () => {
    const req = new NextRequest('http://localhost:3000/api/health', {
      headers: { 'x-request-id': 'health_req_123' },
    })

    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('x-request-id')).toBe('health_req_123')

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('healthy')
    expect(body.data.uptimeSeconds).toBeGreaterThanOrEqual(0)
    expect(body.data.environment).toBeDefined()
    expect(body.requestId).toBe('health_req_123')
    expect(body.timestamp).toBeDefined()
  })
})
