import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as handleRiskGet } from '@/app/api/risk/route'
import * as ensembleModule from '@/lib/weather/ensemble'
import type { RainfallSeries } from '@/lib/weather/types'
import { PERMANENT_DISCLAIMER } from '@/lib/provenance'


describe('Live Mode Fallback, Degraded State & Beyond Calibration', () => {
  it('falls back to cached snapshot with kind: "cached" when upstream provider fails', async () => {
    const mockSnapshotSeries: RainfallSeries = {
      cityId: 'amritsar',
      issueTime: '2026-10-14T00:00:00+05:30',
      hours: ['2026-10-14T00:00:00+05:30', '2026-10-14T01:00:00+05:30'],
      deterministic: [1.0, 2.0],
      model: 'snapshot_fallback',
      gridKm: 9,
      provenance: {
        kind: 'cached',
        source: 'Open-Meteo Forecast (Snapshot)',
        fetchedAt: '2026-10-14T00:00:00Z',
        ageSeconds: 300,
        note: 'Cached snapshot (300s old)',
      },
    }

    vi.spyOn(ensembleModule, 'fetchEnsembleForecast').mockResolvedValueOnce({
      status: 'ok',
      data: mockSnapshotSeries,
      provenance: mockSnapshotSeries.provenance,
    })

    const req = new NextRequest('http://localhost:3000/api/risk?cityId=amritsar&mode=live', {
      method: 'GET',
    })
    const res = await handleRiskGet(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.mode).toBe('live')

    const rainfallProv = json.data.provenance[0]
    expect(rainfallProv.kind).toBe('cached')
    expect(rainfallProv.ageSeconds).toBe(300)
  })

  it('returns HTTP 503 degraded response when provider fails and no snapshot exists', async () => {
    vi.spyOn(ensembleModule, 'fetchEnsembleForecast').mockResolvedValueOnce({
      status: 'degraded',
      provenance: {
        kind: 'derived',
        source: 'Open-Meteo Ensemble (Unavailable)',
        note: 'DEGRADED — All models failed. No snapshot available.',
      },
      error: 'Network connection timeout',
    })

    const req = new NextRequest('http://localhost:3000/api/risk?cityId=amritsar&mode=live', {
      method: 'GET',
    })
    const res = await handleRiskGet(req)
    expect(res.status).toBe(503)

    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('DEGRADED_NO_SNAPSHOT')
    expect(json.error.details.status).toBe('degraded')
    expect(json.error.details.disclaimer).toBe(PERMANENT_DISCLAIMER)
  })

  it('calculates genuine ensemble confidence when multi-member forecast is provided', async () => {
    const mockEnsembleSeries: RainfallSeries = {
      cityId: 'amritsar',
      issueTime: '2026-10-14T00:00:00+05:30',
      hours: ['2026-10-14T00:00:00+05:30', '2026-10-14T01:00:00+05:30'],
      members: [
        [10.0, 15.0], // Member 0
        [10.5, 14.8], // Member 1
        [9.8, 15.2],  // Member 2
      ],
      model: 'ecmwf_ifs025',
      gridKm: 25,
      provenance: {
        kind: 'live',
        source: 'Open-Meteo Ensemble (ecmwf_ifs025)',
      },
    }

    vi.spyOn(ensembleModule, 'fetchEnsembleForecast').mockResolvedValueOnce({
      status: 'ok',
      data: mockEnsembleSeries,
      provenance: mockEnsembleSeries.provenance,
    })

    const req = new NextRequest('http://localhost:3000/api/risk?cityId=amritsar&mode=live&t=0', {
      method: 'GET',
    })
    const res = await handleRiskGet(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.selectedHour.hasEnsemble).toBe(true)
    expect(json.data.selectedHour.confidence).not.toBe('unavailable')
    expect(['high', 'medium', 'low']).toContain(json.data.selectedHour.confidence)
  })

  it('triggers beyondCalibration: true when rainfall exceeds 1.5x extreme band threshold (2.25)', async () => {
    // Extreme rain scenario: peak 90mm in 2 hours -> RTI will be > 10
    const req = new NextRequest(
      'http://localhost:3000/api/risk?cityId=amritsar&mode=scenario&peakMm1h=90&durationH=2',
      { method: 'GET' }
    )
    const res = await handleRiskGet(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.beyondCalibration).toBe(true)
    expect(json.data.beyondCalibrationReason).toContain('exceeds 1.5x extreme-band threshold')
  })

  it('keeps beyondCalibration: false for moderate within-calibration events', async () => {
    // Light rain scenario: peak 2mm in 3 hours -> RTI ~ 0.5
    const req = new NextRequest(
      'http://localhost:3000/api/risk?cityId=amritsar&mode=scenario&peakMm1h=2&durationH=3',
      { method: 'GET' }
    )
    const res = await handleRiskGet(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.beyondCalibration).toBe(false)
    expect(json.data.beyondCalibrationReason).toBeUndefined()
  })

  it('defaults selected hour to peak RTI hour when t is omitted with deterministic tie-breaking', async () => {
    // Triangular hyetograph peak at hour 1 (durationH=3 -> peakIndex=1)
    const req = new NextRequest(
      'http://localhost:3000/api/risk?cityId=amritsar&mode=scenario&peakMm1h=40&durationH=3',
      { method: 'GET' }
    )
    const res = await handleRiskGet(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    // Peak hour index should be 1
    expect(json.data.selectedHour.hourIndex).toBe(1)
  })
})
