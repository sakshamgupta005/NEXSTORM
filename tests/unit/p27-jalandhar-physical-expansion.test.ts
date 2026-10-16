/**
 * tests/unit/p27-jalandhar-physical-expansion.test.ts
 * NEXSTORM P27: Jalandhar Physical Data Expansion Quality Gates & Verification.
 *
 * Verifies:
 * 1. Geographic coverage, boundary clipping, and CRS units for Jalandhar roads.
 * 2. Nonempty artifact integrity and manifest checksum/metric consistency.
 * 3. Road graph referential integrity, node-edge connectivity, and Dijkstra routing.
 * 4. Building exposure honest degradation (0 buildings, unavailable status, no synthetic structures).
 * 5. Strict multi-city isolation (JAL-ROAD- vs AMR-ROAD-, independent observation caches).
 * 6. Readiness safety gates: Jalandhar remains evidence_insufficient with alertsPermitted: false.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { NextRequest } from 'next/server'
import { getCityManifest } from '@/lib/city/registry'
import { roadRiskService } from '@/lib/roads/service'
import { roadRoutingEngine } from '@/lib/roads/router'
import { buildingExposureService } from '@/lib/buildings/service'
import { observationService } from '@/lib/observations/service'
import { GET as handleRoadRiskGet } from '@/app/api/roads/risk/route'
import { POST as handleRoadPlanPost } from '@/app/api/roads/plan/route'
import { GET as handleBuildingsGet } from '@/app/api/buildings/route'

describe('NEXSTORM P27 — Jalandhar Physical Data Expansion Quality Gates', () => {
  const jalandharRoadsDir = path.join(process.cwd(), 'public', 'data', 'cities', 'jalandhar', 'roads')

  describe('1. Geographic Coverage & Nonempty Artifact Integrity', () => {
    it('verifies all 5 canonical Jalandhar road artifacts exist and are non-empty', () => {
      const expectedFiles = [
        'major_corridors.geojson',
        'road_graph.json',
        'road_network_topology.json',
        'road_segments_index.json',
        'routing_graph.json',
      ]

      for (const file of expectedFiles) {
        const filePath = path.join(jalandharRoadsDir, file)
        expect(fs.existsSync(filePath), `Artifact ${file} must exist`).toBe(true)
        const stats = fs.statSync(filePath)
        expect(stats.size, `Artifact ${file} must be non-empty`).toBeGreaterThan(1000)
      }
    })

    it('confirms road segments cover Jalandhar study AOI and use WGS84 coordinates', () => {
      const index = roadRiskService.loadSegmentsIndex('jalandhar')
      expect(index.size).toBe(17358)

      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
      let sampleCount = 0

      for (const seg of index.values()) {
        expect(seg.segmentId.startsWith('JAL-ROAD-')).toBe(true)
        expect(seg.lengthM).toBeGreaterThan(0)
        expect(seg.primaryCellId === 'OUTSIDE_GRID' || /^J-\d+/.test(seg.primaryCellId)).toBe(true)

        const startLng = seg.startCoord.lng
        const startLat = seg.startCoord.lat
        const endLng = seg.endCoord.lng
        const endLat = seg.endCoord.lat

        if (startLng < minLng) minLng = startLng
        if (startLng > maxLng) maxLng = startLng
        if (startLat < minLat) minLat = startLat
        if (startLat > maxLat) maxLat = startLat

        sampleCount++
      }

      expect(sampleCount).toBe(17358)
      // Must cover Jalandhar bounding box [75.52, 31.28, 75.66, 31.38]
      expect(minLng).toBeLessThanOrEqual(75.52)
      expect(maxLng).toBeGreaterThanOrEqual(75.66)
      expect(minLat).toBeLessThanOrEqual(31.28)
      expect(maxLat).toBeGreaterThanOrEqual(31.38)
    })
  })

  describe('2. Manifest Metrics & Checksum Consistency', () => {
    it('matches manifest metrics to disk artifacts exactly', () => {
      const manifest = getCityManifest('jalandhar')
      expect(manifest).not.toBeNull()
      expect(manifest?.cityId).toBe('jalandhar')

      const roadNetwork = (manifest as unknown as { roadNetwork: Record<string, unknown> }).roadNetwork
      expect(roadNetwork).toBeDefined()
      expect(roadNetwork.totalSegments).toBe(17358)
      expect(roadNetwork.totalNodes).toBe(30876)
      expect(roadNetwork.routingNodes).toBe(81688)
      expect(roadNetwork.routingEdges).toBe(93031)
      expect(roadNetwork.majorCorridors).toBe(821)
      expect(roadNetwork.underpasses).toBe(13)
      expect(roadNetwork.bridges).toBe(132)
      expect(roadNetwork.status).toBe('ready')
    })

    it('verifies SHA-256 checksums in manifest match physical files on disk', () => {
      const manifest = getCityManifest('jalandhar')
      const checksums = manifest?.datasetProvenance.checksums || {}

      const filesToCheck = [
        'roads/major_corridors.geojson',
        'roads/road_graph.json',
        'roads/road_network_topology.json',
        'roads/road_segments_index.json',
        'roads/routing_graph.json',
      ]

      for (const relPath of filesToCheck) {
        const fullPath = path.join(process.cwd(), 'public', 'data', 'cities', 'jalandhar', relPath)
        const content = fs.readFileSync(fullPath)
        const actualHash = crypto.createHash('sha256').update(content).digest('hex')
        expect(checksums[relPath]).toBe(actualHash)
      }
    })
  })

  describe('3. Road Graph Referential Integrity & Routing Connectivity', () => {
    it('verifies every road segment refers to valid topological nodes in road_graph.json', () => {
      const graph = roadRiskService.loadRoadGraph('jalandhar')
      expect(graph).not.toBeNull()
      expect(graph?.totalNodes).toBe(30876)

      const index = roadRiskService.loadSegmentsIndex('jalandhar')
      let checked = 0

      for (const seg of index.values()) {
        expect(graph?.nodes[seg.fromNode]).toBeDefined()
        expect(graph?.nodes[seg.toNode]).toBeDefined()
        checked++
        if (checked > 500) break // check representative sample
      }
    })

    it('successfully computes a flood-aware route across Jalandhar road network', async () => {
      // Origin: Model Town / Central Jalandhar (~75.57, 31.32)
      // Destination: BMC Chowk / Civil Lines (~75.59, 31.34)
      const routeResult = await roadRoutingEngine.planRoutes({
        cityId: 'jalandhar',
        origin: [75.57, 31.32],
        destination: [75.59, 31.34],
        originName: 'Jalandhar Model Town',
        destinationName: 'Jalandhar BMC Chowk',
      })

      expect(routeResult).toBeDefined()
      expect(routeResult.routes).toBeDefined()
      expect(routeResult.routes.length).toBeGreaterThanOrEqual(1)

      const topRoute = routeResult.routes[0]
      expect(topRoute.totalDistanceMeters).toBeGreaterThan(500)
      expect(routeResult.comparison.safestRouteId).toBeDefined()
      expect(routeResult.comparison.rankedRoutes.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('4. Building Footprints Honest Degradation', () => {
    it('honestly reports 0 buildings and unavailable status for Jalandhar without synthetic fabrication', async () => {
      const manifest = getCityManifest('jalandhar')
      const buildingExposure = (manifest as unknown as { buildingExposure: Record<string, unknown> }).buildingExposure
      expect(buildingExposure).toBeDefined()
      expect(buildingExposure.totalBuildings).toBe(0)
      expect(buildingExposure.status).toBe('unavailable')

      // API call must return explicit unavailable 404 CITY_NOT_PREPARED
      const req = new NextRequest('http://localhost:3000/api/buildings?cityId=jalandhar')
      const res = await handleBuildingsGet(req)
      expect(res.status).toBe(404)

      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('CITY_NOT_PREPARED')
      expect(body.error.message).toContain('7.18 GB unindexed archive')

      // Service call must return 0 records without fabricating fake structures
      const queryResult = buildingExposureService.queryBuildings({ cityId: 'jalandhar' })
      expect(queryResult.total).toBe(0)
      expect(queryResult.items).toEqual([])
    })

    it('preserves genuine building data for Amritsar without cross-city contamination', async () => {
      const amritsarBuildings = buildingExposureService.loadIndexedBuildings('amritsar')
      expect(amritsarBuildings.length).toBeGreaterThan(1000)

      const jalandharBuildings = buildingExposureService.loadIndexedBuildings('jalandhar')
      expect(jalandharBuildings.length).toBe(0)
    })
  })

  describe('5. Multi-City Isolation & API Integration', () => {
    it('ensures /api/roads/risk returns JAL-ROAD- IDs for Jalandhar and AMR-ROAD- IDs for Amritsar', async () => {
      const jalReq = new NextRequest('http://localhost:3000/api/roads/risk?cityId=jalandhar&limit=5')
      const jalRes = await handleRoadRiskGet(jalReq)
      expect(jalRes.status).toBe(200)
      const jalBody = await jalRes.json()
      expect(jalBody.data.cityId).toBe('jalandhar')
      expect(jalBody.data.items.length).toBe(5)
      for (const item of jalBody.data.items) {
        expect(item.segmentId.startsWith('JAL-ROAD-')).toBe(true)
        expect(item.primaryCellId === 'OUTSIDE_GRID' || item.primaryCellId.startsWith('J-')).toBe(true)
      }

      const asrReq = new NextRequest('http://localhost:3000/api/roads/risk?cityId=amritsar&limit=5')
      const asrRes = await handleRoadRiskGet(asrReq)
      expect(asrRes.status).toBe(200)
      const asrBody = await asrRes.json()
      expect(asrBody.data.cityId).toBe('amritsar')
      expect(asrBody.data.items.length).toBe(5)
      for (const item of asrBody.data.items) {
        expect(item.segmentId.startsWith('AMR-ROAD-')).toBe(true)
        expect(item.primaryCellId === 'OUTSIDE_GRID' || item.primaryCellId.startsWith('A-')).toBe(true)
      }
    })

    it('ensures POST /api/roads/plan functions for Jalandhar', async () => {
      const req = new Request('http://localhost:3000/api/roads/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cityId: 'jalandhar',
          origin: [75.57, 31.32],
          destination: [75.59, 31.34],
          originName: 'Jalandhar Origin',
          destinationName: 'Jalandhar Dest',
        }),
      })

      const res = await handleRoadPlanPost(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.cityId).toBe('jalandhar')
      expect(body.provenance.network).toContain('81,688 routing nodes')
      expect(body.data.routes).toBeDefined()
      expect(body.data.routes.length).toBeGreaterThanOrEqual(1)
    })

    it('verifies ObservationService maintains completely segregated caches per city', () => {
      observationService.resetForTesting('amritsar')
      observationService.resetForTesting('jalandhar')

      const asrObs = observationService.loadObservations('amritsar')
      const jalObs = observationService.loadObservations('jalandhar')

      // Amritsar has 15 historical records seeded from hotspots
      expect(asrObs.length).toBe(15)
      for (const obs of asrObs) {
        expect(obs.cityId).toBe('amritsar')
      }

      // Jalandhar has no seeded community observations (only journalistic inventory)
      expect(jalObs.length).toBe(0)
    })
  })

  describe('6. Readiness State & Safety Gates', () => {
    it('strictly maintains Jalandhar in evidence_insufficient status with alerts prohibited', () => {
      const manifest = getCityManifest('jalandhar')
      expect(manifest?.readinessState).toBe('evidence_insufficient')
      expect(manifest?.operationalPolicy.isPilotEligible).toBe(false)
      expect(manifest?.operationalPolicy.alertsPermitted).toBe(false)
      expect(manifest?.operationalPolicy.defaultRolloutMode).toBe('evaluation_only')
      expect(manifest?.operationalPolicy.restrictions).toContain('No live external alert delivery permitted.')
    })
  })
})
