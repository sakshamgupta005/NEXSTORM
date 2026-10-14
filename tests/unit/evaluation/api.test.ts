import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as handleEvaluationGet } from '@/app/api/evaluation/route'

describe('GET /api/evaluation', () => {
  const FROZEN_CONFIG_HASH = '74f463261a4c15cdc850b8d5be687bee4e59fd2950b7b93395449f3dacefcd49'

  it('returns HTTP 200 with verified offline evaluation summary and canonical configHash', async () => {
    const req = new NextRequest('http://localhost:3000/api/evaluation?cityId=amritsar', {
      method: 'GET',
    })

    const res = await handleEvaluationGet(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)

    const data = json.data
    expect(data.source).toBe('static')
    expect(data.configHash).toBe(FROZEN_CONFIG_HASH)
    expect(data.cityId).toBe('amritsar')

    // Headline metrics
    expect(data.headlineMetrics).toBeDefined()
    expect(data.headlineMetrics.e1_forecast.status).toBe('incomplete')
    expect(data.headlineMetrics.e2_susceptibility.rocAuc).toBe(0.5609)
    expect(data.headlineMetrics.e2_susceptibility.binomialExact95CI).toEqual([0.2659, 0.7873])
    expect(data.headlineMetrics.e3_events.modelPod).toBe(0.6667)
    expect(data.headlineMetrics.e3_events.modelWilson95CI).toEqual([0.3542, 0.8794])

    // Limitations
    expect(Array.isArray(data.limitations)).toBe(true)
    expect(data.limitations.length).toBeGreaterThanOrEqual(5)
  })

  it('returns HTTP 400 for unsupported city', async () => {
    const req = new NextRequest('http://localhost:3000/api/evaluation?cityId=unknown_city', {
      method: 'GET',
    })

    const res = await handleEvaluationGet(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('CONFIG_VERIFICATION_FAILED')
  })
})
