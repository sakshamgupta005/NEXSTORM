/**
 * City Registry & Configuration Loader
 * Validates frozen configuration integrity against Python-canonical SHA-256 hash.
 * Enforces strict feature validation and rejects any synthetic data.
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
export * from './types'
import type {
  CityBootstrapManifest,
  CityConfig,
  CityQualityReport,
  HotspotRecord,
  SusceptibilityGeoJson,
} from './types'

// In-memory static cache for fast server execution
const configCache: Record<string, CityConfig> = {}
const geoJsonCache: Record<string, SusceptibilityGeoJson> = {}
const hotspotCache: Record<string, HotspotRecord[]> = {}
const manifestCache: Record<string, CityBootstrapManifest | null> = {}
const qualityReportCache: Record<string, CityQualityReport | null> = {}

// Runtime registered cities (for test isolation and synthetic fixture testing)
const runtimeConfigs: Record<string, CityConfig> = {}
const runtimeGeoJsons: Record<string, SusceptibilityGeoJson> = {}

export function registerCityConfig(config: CityConfig): void {
  const norm = config.id.toLowerCase()
  verifyConfigIntegrity(config)
  runtimeConfigs[norm] = config
  configCache[norm] = config
}

export function registerCitySusceptibility(cityId: string, geojson: SusceptibilityGeoJson): void {
  const norm = cityId.toLowerCase()
  validateSusceptibilityGeoJson(geojson, norm)
  runtimeGeoJsons[norm] = geojson
  geoJsonCache[norm] = geojson
}

export function clearCityCache(cityId?: string): void {
  if (cityId) {
    const norm = cityId.toLowerCase()
    delete configCache[norm]
    delete geoJsonCache[norm]
    delete hotspotCache[norm]
    delete manifestCache[norm]
    delete qualityReportCache[norm]
    delete runtimeConfigs[norm]
    delete runtimeGeoJsons[norm]
  } else {
    for (const k of Object.keys(configCache)) delete configCache[k]
    for (const k of Object.keys(geoJsonCache)) delete geoJsonCache[k]
    for (const k of Object.keys(hotspotCache)) delete hotspotCache[k]
    for (const k of Object.keys(manifestCache)) delete manifestCache[k]
    for (const k of Object.keys(qualityReportCache)) delete qualityReportCache[k]
    for (const k of Object.keys(runtimeConfigs)) delete runtimeConfigs[k]
    for (const k of Object.keys(runtimeGeoJsons)) delete runtimeGeoJsons[k]
  }
}

function discoverCitiesOnDisk(): string[] {
  const citiesDir = path.join(process.cwd(), 'public', 'data', 'cities')
  if (!fs.existsSync(citiesDir)) return ['amritsar']
  try {
    const entries = fs.readdirSync(citiesDir, { withFileTypes: true })
    const cities: string[] = []
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const confPath = path.join(citiesDir, entry.name, 'city.config.json')
        if (fs.existsSync(confPath)) {
          cities.push(entry.name.toLowerCase())
        }
      }
    }
    return cities.length > 0 ? cities : ['amritsar']
  } catch {
    return ['amritsar']
  }
}

export function listSupportedCities(): string[] {
  const onDisk = discoverCitiesOnDisk()
  const runtime = Object.keys(runtimeConfigs)
  const all = Array.from(new Set([...onDisk, ...runtime, 'amritsar'])).sort()
  return all
}

export function isCitySupported(cityId: string): boolean {
  if (!cityId) return false
  const norm = cityId.toLowerCase()
  return listSupportedCities().includes(norm)
}

export const isValidCityId = isCitySupported

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

  if (runtimeConfigs[normalized]) {
    return runtimeConfigs[normalized]
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

  if (runtimeGeoJsons[normalized]) {
    return runtimeGeoJsons[normalized]
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

const campusGeoJsonCache: Record<string, SusceptibilityGeoJson> = {}

export function getCityCampusSusceptibility(cityId: string): SusceptibilityGeoJson {
  const normalized = (cityId || '').toLowerCase()
  if (!isCitySupported(normalized)) {
    throw new Error(`Unknown city '${cityId}'. No campus susceptibility data found.`)
  }

  if (campusGeoJsonCache[normalized]) {
    return campusGeoJsonCache[normalized]
  }

  const filePath = path.join(
    process.cwd(),
    'public',
    'data',
    'cities',
    normalized,
    'campus_susceptibility.geojson'
  )

  if (!fs.existsSync(filePath)) {
    throw new Error(`Campus susceptibility GeoJSON missing at ${filePath}`)
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  const geojson = JSON.parse(content) as SusceptibilityGeoJson

  validateSusceptibilityGeoJson(geojson, normalized)

  campusGeoJsonCache[normalized] = geojson
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

export function getCityManifest(cityId: string): CityBootstrapManifest | null {
  const normalized = (cityId || '').toLowerCase()
  if (!isCitySupported(normalized)) {
    return null
  }

  if (manifestCache[normalized] !== undefined) {
    return manifestCache[normalized]
  }

  const filePath = path.join(
    process.cwd(),
    'public',
    'data',
    'cities',
    normalized,
    'manifest.json'
  )

  if (!fs.existsSync(filePath)) {
    manifestCache[normalized] = null
    return null
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const manifest = JSON.parse(content) as CityBootstrapManifest
    manifestCache[normalized] = manifest
    return manifest
  } catch {
    manifestCache[normalized] = null
    return null
  }
}

export function getCityQualityReport(cityId: string): CityQualityReport | null {
  const normalized = (cityId || '').toLowerCase()
  if (!isCitySupported(normalized)) {
    return null
  }

  if (qualityReportCache[normalized] !== undefined) {
    return qualityReportCache[normalized]
  }

  const filePath = path.join(
    process.cwd(),
    'public',
    'data',
    'cities',
    normalized,
    'quality_report.json'
  )

  if (!fs.existsSync(filePath)) {
    qualityReportCache[normalized] = null
    return null
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const report = JSON.parse(content) as CityQualityReport
    qualityReportCache[normalized] = report
    return report
  } catch {
    qualityReportCache[normalized] = null
    return null
  }
}

