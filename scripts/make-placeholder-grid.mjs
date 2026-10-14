/**
 * Deterministic Placeholder Susceptibility Grid Generator for NEXSTORM
 * 
 * Generates ~250m resolution polygon cells over Amritsar bounding box.
 * Susceptibility s is generated using seeded multi-scale harmonic noise (0..1).
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const CITY_CONFIG = {
  id: 'amritsar',
  name: 'Amritsar',
  state: 'Punjab',
  country: 'India',
  center: [31.634, 74.872],
  bbox: {
    minLat: 31.55,
    maxLat: 31.72,
    minLng: 74.80,
    maxLng: 74.95,
  },
  gridSizeM: 250,
  thresholds: {
    T1h: 25.0,
    T3h: 50.0,
    T24h: 64.5,
    T72h: 120.0,
    provisional: true,
  },
  synthetic: true,
  disclaimer: 'DEMO DATA — Bounding box, grid susceptibility, and thresholds are synthetic research placeholders. Not official flood or municipal survey data.',
}

function generateGrid() {
  const targetDir = path.join(ROOT, 'public', 'data', 'cities', 'amritsar')
  fs.mkdirSync(targetDir, { recursive: true })

  // Write city config
  fs.writeFileSync(
    path.join(targetDir, 'city.config.json'),
    JSON.stringify(CITY_CONFIG, null, 2),
    'utf-8'
  )
  console.log('✓ Written city.config.json')

  const { minLat, maxLat, minLng, maxLng } = CITY_CONFIG.bbox
  
  // 1 deg lat ~ 111,000m -> 250m is approx 0.00225 deg
  const dLat = 250 / 111000
  // at lat 31.6, 1 deg lng ~ 111,000 * cos(31.634 deg) ~ 94,500m -> 250m is approx 0.002645 deg
  const avgLatRad = ((minLat + maxLat) / 2) * (Math.PI / 180)
  const dLng = 250 / (111000 * Math.cos(avgLatRad))

  const features = []
  let row = 0
  
  for (let lat = minLat; lat < maxLat; lat += dLat) {
    let col = 0
    for (let lng = minLng; lng < maxLng; lng += dLng) {
      const cellId = `amritsar_${row}_${col}`
      
      // Seeded smooth harmonic susceptibility
      const nx = col * 0.12
      const ny = row * 0.12
      const base = 0.5 + 
        0.26 * Math.sin(nx * 1.5 + 1.2) * Math.cos(ny * 1.4 + 0.8) +
        0.16 * Math.sin((nx + ny) * 2.1) +
        0.08 * Math.cos((nx - ny) * 3.5)
      
      // Clamp between 0.05 and 0.95 and round to 3 decimals
      const s = Math.max(0.05, Math.min(0.95, Math.round(base * 1000) / 1000))
      
      // Polygon coords [lng, lat]
      const coordinates = [
        [
          [Math.round(lng * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5],
          [Math.round((lng + dLng) * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5],
          [Math.round((lng + dLng) * 1e5) / 1e5, Math.round((lat + dLat) * 1e5) / 1e5],
          [Math.round(lng * 1e5) / 1e5, Math.round((lat + dLat) * 1e5) / 1e5],
          [Math.round(lng * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5],
        ],
      ]

      features.push({
        type: 'Feature',
        id: cellId,
        geometry: {
          type: 'Polygon',
          coordinates,
        },
        properties: {
          id: cellId,
          s,
          synthetic: true,
        },
      })
      col++
    }
    row++
  }

  const geojson = {
    type: 'FeatureCollection',
    metadata: {
      cityId: 'amritsar',
      cellCount: features.length,
      gridSizeM: 250,
      generatedAt: new Date().toISOString(),
      synthetic: true,
    },
    features,
  }

  fs.writeFileSync(
    path.join(targetDir, 'susceptibility.geojson'),
    JSON.stringify(geojson),
    'utf-8'
  )
  console.log(`✓ Generated ${features.length} cells in susceptibility.geojson`)
}

generateGrid()
