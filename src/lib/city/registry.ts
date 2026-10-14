/**
 * City Registry & Configuration Loader
 */

import fs from 'fs'
import path from 'path'
import type { RtiThresholds } from '../risk/types'

export interface CityBbox {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

export interface CityConfig {
  id: string
  name: string
  state: string
  country: string
  center: [number, number]
  bbox: CityBbox
  gridSizeM: number
  thresholds: RtiThresholds
  synthetic: boolean
  disclaimer: string
}

export interface SusceptibilityFeature {
  type: 'Feature'
  id: string
  geometry: {
    type: 'Polygon'
    coordinates: number[][][]
  }
  properties: {
    id: string
    s: number
    synthetic: boolean
  }
}

export interface SusceptibilityGeoJson {
  type: 'FeatureCollection'
  metadata: {
    cityId: string
    cellCount: number
    gridSizeM: number
    generatedAt: string
    synthetic: boolean
  }
  features: SusceptibilityFeature[]
}

// In-memory static cache for fast server execution
const configCache: Record<string, CityConfig> = {}
const geoJsonCache: Record<string, SusceptibilityGeoJson> = {}

const SUPPORTED_CITIES = ['amritsar']

export function isCitySupported(cityId: string): boolean {
  if (!cityId) return false
  return SUPPORTED_CITIES.includes(cityId.toLowerCase())
}

export const isValidCityId = isCitySupported

export function listSupportedCities(): string[] {
  return [...SUPPORTED_CITIES]
}

export function getCityConfig(cityId: string): CityConfig {
  const normalized = (cityId || '').toLowerCase()
  if (!isCitySupported(normalized)) {
    throw new Error(`Unknown city '${cityId}'. No configuration found.`)
  }

  if (configCache[normalized]) {
    return configCache[normalized]
  }

  const filePath = path.join(
    process.cwd(),
    'public',
    'data',
    'cities',
    normalized,
    'city.config.json'
  )

  if (!fs.existsSync(filePath)) {
    throw new Error(`City configuration file missing at ${filePath}`)
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  const config = JSON.parse(content) as CityConfig
  configCache[normalized] = config
  return config
}

export function getCitySusceptibility(cityId: string): SusceptibilityGeoJson {
  const normalized = (cityId || '').toLowerCase()
  if (!isCitySupported(normalized)) {
    throw new Error(`Unknown city '${cityId}'. No susceptibility data found.`)
  }

  if (geoJsonCache[normalized]) {
    return geoJsonCache[normalized]
  }

  const filePath = path.join(
    process.cwd(),
    'public',
    'data',
    'cities',
    normalized,
    'susceptibility.geojson'
  )

  if (!fs.existsSync(filePath)) {
    throw new Error(`City susceptibility GeoJSON missing at ${filePath}`)
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  const geojson = JSON.parse(content) as SusceptibilityGeoJson
  geoJsonCache[normalized] = geojson
  return geojson
}
