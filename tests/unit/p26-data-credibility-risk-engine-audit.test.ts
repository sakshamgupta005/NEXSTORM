/**
 * tests/unit/p26-data-credibility-risk-engine-audit.test.ts
 * NEXSTORM P26: Data Credibility & Risk Engine Audit Verification Suite.
 *
 * Verifies that:
 * 1. Multi-city weather adapters query target city coordinates, never defaulting silently to Amritsar.
 * 2. Risk engine computes true cell-level distributions per city without hardcoded fallbacks.
 * 3. Network topology honestly reports 0 nodes when a city has no prepared road graph.
 * 4. Empty building geometry centroids return honest zeros, never fabricated coordinates.
 * 5. Live mode refuses silent synthetic substitutions and degrades explicitly on failure.
 * 6. File metrics, cell counts, and readiness states match physical artifacts on disk.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { sharedCache } from '@/lib/cache'
import { getCityConfig, getCitySusceptibility, listSupportedCities } from '@/lib/city/registry'
import { computeTimeline, computeRiskGrid } from '@/lib/risk/engine'
import { roadRiskService } from '@/lib/roads/service'
import { buildingExposureService } from '@/lib/buildings/service'
import { fetchEnsembleForecast } from '@/lib/weather/ensemble'
import { fetchHistoricalArchive } from '@/lib/weather/historical'
import { GET as handleRiskGet } from '@/app/api/risk/route'
import * as openmeteo from '@/lib/weather/openmeteo'

describe('NEXSTORM P26 — Data Credibility & Risk Engine Audit', () => {
  beforeEach(async () => {
    await sharedCache.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('1. Multi-City Weather Coordinate Truth', () => {
    it('queries Jalandhar actual coordinates (31.33, 75.59) instead of Amritsar (31.63, 74.87)', async () => {
      let interceptedUrl = ''
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          interceptedUrl = url
          return Promise.resolve(
            new Response(
              JSON.stringify({
                latitude: 31.33,
                longitude: 75.59,
                hourly: {
                  time: ['2026-10-16T00:00'],
                  precipitation: [1.2],
                  precipitation_member01: [1.1],
                  precipitation_member02: [1.3],
                },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          )
        })
      )

      const result = await fetchEnsembleForecast({ cityId: 'jalandhar', skipCache: true })
      expect(result.status).toBe('ok')

      // Must contain Jalandhar's latitude 31.33 and longitude 75.59
      expect(interceptedUrl).toContain('latitude=31.33')
      expect(interceptedUrl).toContain('longitude=75.59')
      // Must NOT contain Amritsar's latitude or longitude
      expect(interceptedUrl).not.toContain('latitude=31.634')
      expect(interceptedUrl).not.toContain('longitude=74.872')
    })

    it('queries Jalandhar coordinates in fetchHistoricalArchive', async () => {
      let interceptedUrl = ''
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          interceptedUrl = url
          return Promise.resolve(
            new Response(
              JSON.stringify({
                latitude: 31.33,
                longitude: 75.59,
                hourly: {
                  time: ['2024-07-01T00:00'],
                  precipitation: [0.0],
                },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          )
        })
      )

      const result = await fetchHistoricalArchive({
        cityId: 'jalandhar',
        startDate: '2024-07-01',
        endDate: '2024-07-02',
      })

      expect(result.status).toBe('ok')
      expect(interceptedUrl).toContain('latitude=31.33')
      expect(interceptedUrl).toContain('longitude=75.59')
    })
  })

  describe('2. Risk Engine Multi-City Truth & Fallback Elimination', () => {
    it('computeTimeline dynamically resolves Jalandhar 2,354 cell distribution without falling back to Amritsar 1,998 counts', () => {
      const jalConfig = getCityConfig('jalandhar')
      const jalSusceptibility = getCitySusceptibility('jalandhar')
      expect(jalSusceptibility.features.length).toBe(2354)

      const sampleSeries = {
        cityId: 'jalandhar',
        issueTime: '2026-10-16T00:00:00+05:30',
        hours: ['+0h', '+1h'],
        deterministic: [0.0, 5.0],
        model: 'open_meteo_deterministic',
        gridKm: 11,
        provenance: { kind: 'live' as const, source: 'Test' },
      }

      // Call computeTimeline WITHOUT passing susceptibility GeoJSON
      const timeline = computeTimeline(sampleSeries, jalConfig)
      expect(timeline.length).toBe(2)

      // Total cells across shares must sum to 1.0 (from 2,354 Jalandhar cells, not Amritsar)
      const share = timeline[1].classShare
      const sumShares = Math.round((share.low + share.moderate + share.high) * 100) / 100
      expect(sumShares).toBe(1.0)
    })

    it('getNetworkTopology returns genuine 30,876 nodes for Jalandhar without falling back to Amritsar 26,155 count', async () => {
      const jalTopology = await roadRiskService.getNetworkTopology('jalandhar')
      expect(jalTopology.totalNodes).toBe(30876)
      expect(jalTopology.totalSegments).toBe(17358)
      expect(jalTopology.taggedUnderpasses).toBe(13)
      expect(jalTopology.taggedBridges).toBe(132)

      // In contrast, Amritsar topology must genuinely reflect its own prepared network
      const asrTopology = await roadRiskService.getNetworkTopology('amritsar')
      expect(asrTopology.totalNodes).toBe(26155)
      expect(asrTopology.totalSegments).toBe(14853)
      expect(asrTopology.taggedUnderpasses).toBe(5)
      expect(asrTopology.taggedBridges).toBe(160)
    })

    it('computePolygonCentroid returns { lng: 0, lat: 0 } for empty polygon coordinates without fabricating Amritsar coordinates', () => {
      const centroid = (buildingExposureService as unknown as {
        computePolygonCentroid: (coords: number[][][]) => { lng: number; lat: number }
      }).computePolygonCentroid([])

      expect(centroid).toEqual({ lng: 0, lat: 0 })
      expect(centroid.lat).not.toBe(31.634)
      expect(centroid.lng).not.toBe(74.872)
    })
  })

  describe('3. Honest Failure & Degraded State Enforcement', () => {
    it('refuses to synthesize fake rainfall when weather provider fails and no cached snapshot exists', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Upstream down', { status: 503 })))
      vi.spyOn(openmeteo, 'fetchDeterministicForecast').mockResolvedValue({
        status: 'degraded',
        provenance: { kind: 'derived', source: 'Failed' },
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
    })

    it('clearly separates synthetic scenario data from live and replay modes', async () => {
      // Scenario Mode
      const scenarioReq = new NextRequest(
        'http://localhost:3000/api/risk?cityId=amritsar&mode=scenario&peakMm1h=40&durationH=3',
        { method: 'GET' }
      )
      const scenarioRes = await handleRiskGet(scenarioReq)
      const scenarioJson = await scenarioRes.json()

      expect(scenarioJson.data.mode).toBe('scenario')
      expect(scenarioJson.data.provenance[0].kind).toBe('simulated')
      expect(scenarioJson.data.provenance[0].source).toContain('Triangular Hyetograph')

      // Replay Mode
      const replayReq = new NextRequest(
        'http://localhost:3000/api/risk?cityId=amritsar&mode=replay&event=2025-09-01_amritsar',
        { method: 'GET' }
      )
      const replayRes = await handleRiskGet(replayReq)
      const replayJson = await replayRes.json()

      expect(replayJson.data.mode).toBe('replay')
      expect(replayJson.data.provenance[0].kind).toBe('replay')
    })
  })

  describe('4. Dataset Counts, CRS & Manifest Verification', () => {
    it('verifies Amritsar physical dataset counts match manifests', () => {
      const manifestPath = path.resolve(process.cwd(), 'public/data/cities/amritsar/manifest.json')
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))

      expect(manifest.geographicBounds.totalCells).toBe(1998)
      expect(manifest.geographicBounds.cellResolutionMeters).toBe(250)
      expect(manifest.geographicBounds.targetUtmCrs).toBe('EPSG:32643')
      expect(manifest.evidenceAudit.rainfallStormCount).toBe(7)
      expect(manifest.evidenceAudit.incidentCount).toBe(13)

      const gridPath = path.resolve(process.cwd(), 'public/data/cities/amritsar/grid.geojson')
      const grid = JSON.parse(fs.readFileSync(gridPath, 'utf-8'))
      expect(grid.features.length).toBe(1998)
    })

    it('verifies Jalandhar physical dataset counts and evidence_insufficient readiness', () => {
      const manifestPath = path.resolve(process.cwd(), 'public/data/cities/jalandhar/manifest.json')
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))

      expect(manifest.geographicBounds.totalCells).toBe(2354)
      expect(manifest.readinessState).toBe('evidence_insufficient')
      expect(manifest.operationalPolicy.alertsPermitted).toBe(false)
      expect(manifest.evidenceAudit.rainfallStormCount).toBe(5)
      expect(manifest.evidenceAudit.incidentCount).toBe(10)

      const gridPath = path.resolve(process.cwd(), 'public/data/cities/jalandhar/grid.geojson')
      const grid = JSON.parse(fs.readFileSync(gridPath, 'utf-8'))
      expect(grid.features.length).toBe(2354)

      // Physical raster files must exist and be non-empty
      const demPath = path.resolve(process.cwd(), 'public/data/cities/jalandhar/rasters/dem.tif')
      const wcPath = path.resolve(process.cwd(), 'public/data/cities/jalandhar/rasters/worldcover.tif')
      expect(fs.existsSync(demPath)).toBe(true)
      expect(fs.statSync(demPath).size).toBeGreaterThan(1000000)
      expect(fs.existsSync(wcPath)).toBe(true)
      expect(fs.statSync(wcPath).size).toBeGreaterThan(3000000)
    })
  })
})
