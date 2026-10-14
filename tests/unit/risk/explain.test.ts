import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as handleCellGet } from '@/app/api/cell/[cellId]/route'
import { explainCellRisk, EXPLANATION_LIMITATIONS } from '@/lib/risk/explain'

describe('Cell Explanations & Factor Contributions', () => {
  it('computes factor contributions and limits for cell A-0590', () => {
    const exp = explainCellRisk('A-0590', 'amritsar')
    expect(exp.cellId).toBe('A-0590')
    expect(exp.cityId).toBe('amritsar')
    expect(exp.sValue).toBeGreaterThan(0)
    expect(exp.sBand).toBeDefined()

    // Factor contributions check
    expect(exp.factorContributions.length).toBe(5)
    for (const fc of exp.factorContributions) {
      expect(fc.factor).toBeDefined()
      expect(fc.label).toBeDefined()
      expect(fc.appliedWeight).toBeGreaterThan(0)
      expect(fc.contribution).toBeCloseTo(fc.featureValue * fc.appliedWeight, 3)
    }

    // Hotspot within 500m check (A-0590 is mapped to H-0001 SSSS Chowk)
    expect(exp.nearbyHotspot).not.toBeNull()
    expect(exp.nearbyHotspot?.name).toContain('SSSS Chowk')
    expect(exp.nearbyHotspot?.distanceMeters).toBeLessThanOrEqual(500)
    expect(exp.nearbyHotspot?.articleDate).toBe('2023-07-09')
    expect(exp.nearbyHotspot?.sourceUrl).toContain('tribuneindia')

    // Scientific limitations
    expect(exp.limitations).toEqual(EXPLANATION_LIMITATIONS)
    expect(exp.limitations).toContain('Coarse, approximately 10–25 km rainfall input.')
    expect(exp.limitations).toContain('Proxy susceptibility features.')
    expect(exp.limitations).toContain('No verified drainage-network data.')
    expect(exp.limitations).toContain('News-derived hotspot evidence.')
  })

  it('returns null nearbyHotspot when no incident is within 500m (A-0001)', () => {
    const exp = explainCellRisk('A-0001', 'amritsar')
    expect(exp.cellId).toBe('A-0001')
    expect(exp.nearbyHotspot).toBeNull()
  })

  describe('GET /api/cell/[cellId]', () => {
    it('returns HTTP 200 with full explanation for valid cell A-0590', async () => {
      const req = new NextRequest('http://localhost:3000/api/cell/A-0590', { method: 'GET' })
      const res = await handleCellGet(req, { params: Promise.resolve({ cellId: 'A-0590' }) })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.cellId).toBe('A-0590')
      expect(json.data.nearbyHotspot.name).toContain('SSSS Chowk')
      expect(json.data.factorContributions.length).toBe(5)
    })

    it('returns HTTP 404 for unknown cell ID', async () => {
      const req = new NextRequest('http://localhost:3000/api/cell/A-9999', { method: 'GET' })
      const res = await handleCellGet(req, { params: Promise.resolve({ cellId: 'A-9999' }) })

      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('CELL_NOT_FOUND')
    })

    it('returns HTTP 400 for malformed cell ID', async () => {
      const req = new NextRequest('http://localhost:3000/api/cell/bad!id@#', { method: 'GET' })
      const res = await handleCellGet(req, { params: Promise.resolve({ cellId: 'bad!id@#' }) })

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('INVALID_CELL_ID')
    })
  })
})
