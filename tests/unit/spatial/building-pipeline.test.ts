import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('P9 Building Ingestion & Spatial Dataset Pipeline', () => {
  const amritsarDir = path.join(process.cwd(), 'public', 'data', 'cities', 'amritsar')
  const buildingsDir = path.join(amritsarDir, 'buildings')
  const gnduDir = path.join(amritsarDir, 'gndu')
  const roadsDir = path.join(amritsarDir, 'roads')

  describe('1. GNDU Campus Building Footprints Asset', () => {
    it('verifies GNDU campus building footprints GeoJSON exists and is valid', () => {
      const gnduPath = path.join(gnduDir, 'buildings.geojson')
      expect(fs.existsSync(gnduPath)).toBe(true)

      const content = JSON.parse(fs.readFileSync(gnduPath, 'utf-8'))
      expect(content.type).toBe('FeatureCollection')
      expect(Array.isArray(content.features)).toBe(true)

      // Verified real Google Open Buildings V3 footprints in GNDU campus
      expect(content.features.length).toBeGreaterThan(500)

      const sample = content.features[0]
      expect(sample.properties).toHaveProperty('buildingId')
      expect(sample.properties.buildingId).toMatch(/^GOB-391-[a-f0-9]{12}$/)
      expect(sample.properties).toHaveProperty('area_m2')
      expect(sample.properties.area_m2).toBeGreaterThan(5) // Sensible building size (>5 m^2)
      expect(sample.properties).toHaveProperty('confidence')
      expect(sample.properties.confidence).toBeGreaterThanOrEqual(0.65)
      expect(sample.geometry.type).toBe('Polygon')
    })
  })

  describe('2. Historical Hotspot Cluster Building Footprints Asset', () => {
    it('verifies historical hotspot cluster building footprints GeoJSON exists', () => {
      const hotspotPath = path.join(buildingsDir, 'hotspot_buildings.geojson')
      expect(fs.existsSync(hotspotPath)).toBe(true)

      const content = JSON.parse(fs.readFileSync(hotspotPath, 'utf-8'))
      expect(content.type).toBe('FeatureCollection')
      expect(Array.isArray(content.features)).toBe(true)
      expect(content.features.length).toBeGreaterThan(50)

      const sample = content.features[0]
      expect(sample.properties).toHaveProperty('buildingId')
      expect(sample.properties).toHaveProperty('area_m2')
      expect(sample.properties).toHaveProperty('exposureCategory')
      expect(['minimal', 'moderate_catchment', 'high_catchment']).toContain(
        sample.properties.exposureCategory
      )
    })
  })

  describe('3. Aggregated Cell Exposure Index', () => {
    it('verifies cell_index.json maps 250m cells to building footprint summaries', () => {
      const indexPath = path.join(buildingsDir, 'cell_index.json')
      expect(fs.existsSync(indexPath)).toBe(true)

      const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
      expect(indexData.version).toBe('1.0.0')
      expect(indexData.source).toBe('Google Open Buildings V3')
      expect(indexData.license).toBe('CC-BY-4.0')
      expect(indexData.totalIndexedBuildings).toBeGreaterThan(1000)
      expect(indexData.matchedCellCount).toBeGreaterThan(50)

      // Check sample cell
      const sampleCellId = Object.keys(indexData.cells)[0]
      const cellSummary = indexData.cells[sampleCellId]

      expect(cellSummary).toHaveProperty('buildingCount')
      expect(cellSummary.buildingCount).toBeGreaterThan(0)
      expect(cellSummary).toHaveProperty('totalFootprintAreaM2')
      expect(cellSummary).toHaveProperty('meanFootprintAreaM2')
      expect(cellSummary).toHaveProperty('highConfidenceCount')
      expect(cellSummary).toHaveProperty('exposureCategory')
    })
  })

  describe('4. Road Network Topology & Underpass Tagging Asset', () => {
    it('verifies road_network_topology.json contains valid network statistics and underpass tags', () => {
      const roadPath = path.join(roadsDir, 'road_network_topology.json')
      expect(fs.existsSync(roadPath)).toBe(true)

      const roadData = JSON.parse(fs.readFileSync(roadPath, 'utf-8'))
      expect(roadData.status).toBe('success')
      expect(roadData.license).toBe('ODbL 1.0')
      expect(roadData.totalInputSegments).toBe(14855)
      expect(roadData.validPreparedSegments).toBeGreaterThan(14800)
      expect(roadData.totalLengthKm).toBeGreaterThan(1000)

      // Topological node graph
      expect(roadData.totalTopologicalNodes).toBeGreaterThan(20000)
      expect(roadData.junctionNodesCount).toBeGreaterThan(500)

      // Underpass and bridge counts
      expect(roadData.underpassCount).toBe(5)
      expect(roadData.bridgeCount).toBeGreaterThan(100)

      // Highway classification breakdown
      expect(roadData.highwayClassificationCounts).toHaveProperty('residential')
      expect(roadData.highwayClassificationCounts.residential).toBeGreaterThan(10000)
    })
  })

  describe('5. Scientific Guardrails & Non-Inference Integrity', () => {
    it('confirms building attributes do NOT include unsupported height, indoor depth, or damage probability', () => {
      const gnduPath = path.join(gnduDir, 'buildings.geojson')
      const content = JSON.parse(fs.readFileSync(gnduPath, 'utf-8'))
      const sampleProps = content.features[0].properties

      expect(sampleProps).not.toHaveProperty('height')
      expect(sampleProps).not.toHaveProperty('floodDepth')
      expect(sampleProps).not.toHaveProperty('indoorDepth')
      expect(sampleProps).not.toHaveProperty('structuralDamage')
      expect(sampleProps).not.toHaveProperty('basement')
      expect(sampleProps).not.toHaveProperty('occupancy')
    })
  })
})
