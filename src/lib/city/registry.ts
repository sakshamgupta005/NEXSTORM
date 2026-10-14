/**
 * City Registry & Configuration Loader
 * Validates frozen configuration integrity against Python-canonical SHA-256 hash.
 * Enforces strict feature validation and rejects any synthetic data.
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { RiskClass, RtiThresholds } from '../risk/types'


export interface CityConfig {
  id: string
  name: string
  bbox: [number, number, number, number]
  gridSizeM: number
  cellCount: number
  weights: {
    depression: number
    flatness: number
    builtUp: number
    lowPoint: number
    densityProxy: number
    [key: string]: number
  }
  terrainOverride: {
    applied: boolean
    reason: string
    std: number
  }
  sBandCutoffs: [number, number]
  rtiBandCutoffs: [number, number, number]
  matrix: RiskClass[][]
  thresholds: RtiThresholds & {
    derivedFrom?: string
    span?: string
  }
  displayThreshold: number
  confidenceCutoffs: [number, number]
  sources: string[]
  version: string
  configHash: string
}

export interface SusceptibilityFeatureProperties {
  id: string
  s: number
  f_depression?: number
  f_flatness?: number
  f_builtUp?: number
  f_lowPoint?: number
  f_density?: number
  nearestRoad?: string
  synthetic?: boolean
  version?: string
}

export interface SusceptibilityFeature {
  type: 'Feature'
  id?: string
  geometry: {
    type: 'Polygon'
    coordinates: number[][][]
  }
  properties: SusceptibilityFeatureProperties
}

export interface SusceptibilityGeoJson {
  type: 'FeatureCollection'
  name?: string
  crs?: {
    type: string
    properties: {
      name: string
    }
  }
  features: SusceptibilityFeature[]
}

export interface HotspotRecord {
  id: string
  name: string
  lat: number
  lon: number
  cellId: string
  sourceUrl?: string
  articleDate?: string
  evidence: string
  precision: string
}

// In-memory static cache for fast server execution
const configCache: Record<string, CityConfig> = {}
const geoJsonCache: Record<string, SusceptibilityGeoJson> = {}
const hotspotCache: Record<string, HotspotRecord[]> = {}

const SUPPORTED_CITIES = ['amritsar']

export function isCitySupported(cityId: string): boolean {
  if (!cityId) return false
  return SUPPORTED_CITIES.includes(cityId.toLowerCase())
}

export const isValidCityId = isCitySupported

export function listSupportedCities(): string[] {
  return [...SUPPORTED_CITIES]
}

/**
 * Computes canonical SHA-256 hash across the frozen configuration subset:
 * {weights, sBandCutoffs, rtiBandCutoffs, matrix, thresholds, displayThreshold}
 * Strictly matching Python's json.dumps(subset, sort_keys=True, separators=(',', ':'))
 */
export function computeCanonicalConfigHash(config: Record<string, unknown>): string {
  const keys = ['weights', 'sBandCutoffs', 'rtiBandCutoffs', 'matrix', 'thresholds', 'displayThreshold']
  const subset: Record<string, unknown> = {}
  for (const k of keys) {
    if (k in config) {
      subset[k] = config[k]
    }
  }

  function canonicalStringify(val: unknown, parentKey?: string): string {
    if (val === null) return 'null'
    if (typeof val === 'boolean') return val ? 'true' : 'false'
    if (typeof val === 'number') {
      if (
        (parentKey === 'rtiBandCutoffs' ||
          parentKey === 'sBandCutoffs' ||
          parentKey === 'weights' ||
          parentKey === 'thresholds' ||
          parentKey === 'displayThreshold') &&
        Number.isInteger(val)
      ) {
        return val.toFixed(1)
      }
      return String(val)
    }
    if (typeof val === 'string') return JSON.stringify(val)
    if (Array.isArray(val)) {
      return '[' + val.map((item) => canonicalStringify(item, parentKey)).join(',') + ']'
    }
    const obj = val as Record<string, unknown>
    const sortedKeys = Object.keys(obj).sort()
    return (
      '{' +
      sortedKeys
        .map((k) => JSON.stringify(k) + ':' + canonicalStringify(obj[k], k))
        .join(',') +
      '}'
    )
  }

  const jsonStr = canonicalStringify(subset)
  return crypto.createHash('sha256').update(jsonStr, 'utf-8').digest('hex')
}

/**
 * Verifies that the configuration object's configHash matches the canonical recomputed hash.
 * Throws an explicit error if tampering or discrepancy is detected.
 */
export function verifyConfigIntegrity(config: CityConfig): void {
  if (!config.configHash) {
    throw new Error(`Configuration for city '${config.id}' is missing required 'configHash'.`)
  }
  const computed = computeCanonicalConfigHash(config as unknown as Record<string, unknown>)
  if (computed !== config.configHash) {
    throw new Error(
      `CONFIGURATION INTEGRITY ERROR: configHash mismatch for city '${config.id}'. Expected: ${config.configHash}, Recomputed: ${computed}. Refusing to calculate risk.`
    )
  }
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

  // Verify integrity
  verifyConfigIntegrity(config)

  configCache[normalized] = config
  return config
}

/**
 * Validates susceptibility features and rejects any synthetic data or malformed geometry.
 */
export function validateSusceptibilityGeoJson(geojson: SusceptibilityGeoJson, cityId: string): void {
  if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    throw new Error(`Invalid GeoJSON structure for city '${cityId}': missing FeatureCollection features.`)
  }

  for (let i = 0; i < geojson.features.length; i++) {
    const f = geojson.features[i]
    if (!f || f.type !== 'Feature' || !f.geometry || !f.properties) {
      throw new Error(`Malformed feature at index ${i} in susceptibility data for '${cityId}'.`)
    }

    if (f.geometry.type !== 'Polygon' || !Array.isArray(f.geometry.coordinates) || f.geometry.coordinates.length === 0) {
      throw new Error(`Feature ${f.properties.id || i} has invalid geometry (expected non-empty Polygon).`)
    }

    if (f.properties.synthetic === true) {
      throw new Error(
        `Feature ${f.properties.id || i} contains synthetic: true; synthetic data is strictly rejected in production.`
      )
    }

    const s = f.properties.s
    if (typeof s !== 'number' || !Number.isFinite(s) || s < 0 || s > 1) {
      throw new Error(`Feature ${f.properties.id || i} has invalid susceptibility score s: ${s}`)
    }

    if (!f.properties.id || typeof f.properties.id !== 'string') {
      throw new Error(`Feature at index ${i} missing valid string id property.`)
    }
  }
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

  validateSusceptibilityGeoJson(geojson, normalized)

  geoJsonCache[normalized] = geojson
  return geojson
}

export function getCityHotspots(cityId: string): HotspotRecord[] {
  const normalized = (cityId || '').toLowerCase()
  if (!isCitySupported(normalized)) {
    throw new Error(`Unknown city '${cityId}'. No hotspots found.`)
  }

  if (hotspotCache[normalized]) {
    return hotspotCache[normalized]
  }

  const filePath = path.join(
    process.cwd(),
    'public',
    'data',
    'cities',
    normalized,
    'hotspots.json'
  )

  if (!fs.existsSync(filePath)) {
    return []
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  const hotspots = JSON.parse(content) as HotspotRecord[]
  hotspotCache[normalized] = hotspots
  return hotspots
}

