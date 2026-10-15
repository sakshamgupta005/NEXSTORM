/**
 * src/lib/provenance.ts
 * Centralized Evidence, Provenance, and Scientific Guardrails Registry for NEXSTORM.
 * Establishes strict semantic separation between:
 * 1. Topographic Susceptibility (static macro-catchment terrain model)
 * 2. Rainfall-Related Risk (continuous matrix output of susceptibility + precipitation accumulation)
 * 3. Building Exposure (spatial footprint overlap only; no structural vulnerability or damage claim)
 * 4. Road Risk & Routing (corridor overlap and underpass chokepoints; 30 km/h baseline without live traffic)
 * 5. Ground-Truth Observations (community reports with explicit freshness, corroboration, and verification status)
 */

import type { Provenance } from './risk/types'
export * from './metadata'

export const PERMANENT_DISCLAIMER =
  'Experimental research prototype. Not an official weather forecast or emergency warning. For official alerts see IMD and NDMA SACHET.'

export const EXTENDED_LIMITATION_DISCLAIMER =
  'NEXSTORM does not predict flood depth, provide verified street-level forecasts, model underground drainage hydraulics, or predict riverine flooding.'

export interface DatasetProvenanceInfo {
  id: string
  name: string
  category: 'numerical_forecast' | 'terrain_model' | 'building_overlay' | 'road_network' | 'crowdsourced_evidence'
  source: string
  license: string
  spatialResolution: string
  freshnessTTLSeconds: number
  primaryLimitations: string[]
}

export const DATASET_PROVENANCE_REGISTRY: Record<string, DatasetProvenanceInfo> = {
  weather_forecast: {
    id: 'weather_forecast',
    name: 'Numerical Weather Forecasts (Open-Meteo)',
    category: 'numerical_forecast',
    source: 'Open-Meteo API (ECMWF, GFS, DWD ICON ensemble/deterministic series)',
    license: 'CC-BY-4.0',
    spatialResolution: '~0.1° (~11 km) bilinearly downscaled to 250m grid',
    freshnessTTLSeconds: 3600, // 1 hour
    primaryLimitations: [
      'Forecast rainfall estimates carry spatial-temporal timing uncertainties.',
      'Single deterministic forecasts report confidence: unavailable without artificial ensemble spread.',
      'Degraded upstream connections fall back to cached snapshots; zero synthetic rainfall is injected.',
    ],
  },
  topographic_susceptibility: {
    id: 'topographic_susceptibility',
    name: 'Topographic Runoff Susceptibility Grid',
    category: 'terrain_model',
    source: 'Copernicus DEM GLO-30 (30m), ESA WorldCover 2021 (10m), OpenStreetMap',
    license: 'Copernicus Open Access / ODbL 1.0 / CC-BY-4.0',
    spatialResolution: '250m square raster cells (1,998 cells in Amritsar, 699 in GNDU campus)',
    freshnessTTLSeconds: Infinity, // Static baseline frozen under SHA-256 configHash
    primaryLimitations: [
      'Captures relative surface runoff accumulation potential based on terrain depression and impervious fabric.',
      'Does NOT model subsurface stormwater drainage hydraulics, pipe capacities, or pumping stations.',
      'Susceptibility is a relative index [0, 1], not a calibrated flood probability.',
    ],
  },
  building_exposure: {
    id: 'building_exposure',
    name: 'Building Footprint Catchment Exposure',
    category: 'building_overlay',
    source: 'Google Open Buildings V3 (360,252 footprints in Amritsar)',
    license: 'CC-BY-4.0',
    spatialResolution: 'Polygon footprints projected to UTM Zone 43N (EPSG:32643)',
    freshnessTTLSeconds: Infinity,
    primaryLimitations: [
      'Measures spatial geometric overlap of building footprints with 250m macro-catchment zones.',
      'Does NOT model structural plinth elevation, foundation height, or basement presence.',
      'Does NOT predict indoor inundation, water depth, or structural damage.',
    ],
  },
  road_network_routing: {
    id: 'road_network_routing',
    name: 'Topological Road Network & Flood-Aware Routing',
    category: 'road_network',
    source: 'OpenStreetMap contributors via planar noded graph (28,418 nodes, 37,924 edges)',
    license: 'ODbL 1.0',
    spatialResolution: 'LineString corridors with meter-accurate geodesic projection',
    freshnessTTLSeconds: Infinity,
    primaryLimitations: [
      'Travel times assume an uncalibrated 30 km/h urban baseline velocity.',
      'Does NOT model live vehicular traffic congestion, traffic signals, or turn delays.',
      'Legal one-way rules and turn restriction relations are unmodeled; edges operate bidirectionally.',
      'Routes avoid modeled high-susceptibility zones and underpasses; never drive into flooded underpasses.',
    ],
  },
  community_observations: {
    id: 'community_observations',
    name: 'Ground-Truth Community Observations & Verified Incidents',
    category: 'crowdsourced_evidence',
    source: 'Citizen-submitted field reports and authorized municipal records',
    license: 'Proprietary user submissions with privacy hashing',
    spatialResolution: 'GPS coordinates snapped to nearest grid cell and road segment within matching tolerance',
    freshnessTTLSeconds: 21600, // 6 hours fresh, 24 hours stale
    primaryLimitations: [
      'Corroboration indicates multiple matching reports from citizens within 250m; it does not equal independent municipal verification.',
      'Only records reviewed with authorized moderator credentials bear verified status.',
      'Reporter identities are pseudonymized via SHA-256 salt-hashing; IPs are never stored in plain text.',
    ],
  },
}

/**
 * Validates freshness status of an observation against its source-specific TTL.
 */
export function evaluateObservationFreshness(observedAt: string): {
  status: 'fresh' | 'stale' | 'expired'
  ageHours: number
  isCurrentEvidence: boolean
} {
  const observedTime = new Date(observedAt).getTime()
  if (isNaN(observedTime)) {
    return { status: 'expired', ageHours: 999, isCurrentEvidence: false }
  }

  const ageMs = Math.max(0, Date.now() - observedTime)
  const ageHours = Math.round((ageMs / (1000 * 60 * 60)) * 10) / 10

  if (ageHours <= 6) {
    return { status: 'fresh', ageHours, isCurrentEvidence: true }
  } else if (ageHours <= 24) {
    return { status: 'stale', ageHours, isCurrentEvidence: false }
  } else {
    return { status: 'expired', ageHours, isCurrentEvidence: false }
  }
}

/**
 * Creates standardized provenance descriptor for simulated rainfall scenarios.
 */
export function createSimulatedRainfallProvenance(source: string = 'NEXSTORM Triangular Hyetograph Generator'): Provenance {
  return {
    kind: 'simulated',
    evidenceClass: 'simulated_demo',
    methodology: 'Synthetic triangular hyetograph storm simulation',
    source,
    fetchedAt: new Date().toISOString(),
    note: 'DEMO DATA — Deterministic triangular hyetograph simulation for research and stress-testing.',
  }
}

/**
 * Creates standardized provenance descriptor for synthetic susceptibility grid.
 */
export function createSyntheticSusceptibilityProvenance(source: string = 'NEXSTORM Seeded Spatial Grid (250m)'): Provenance {
  return {
    kind: 'derived',
    evidenceClass: 'simulated_demo',
    methodology: 'Synthetic spatial coordinate seed (uncalibrated)',
    source,
    fetchedAt: new Date().toISOString(),
    note: 'DEMO DATA — Synthetic seeded susceptibility baseline. Not verified municipal drainage or surveyed elevation data.',
  }
}

/**
 * Creates standardized provenance descriptor for verified susceptibility grid with configHash.
 */
export function createDerivedSusceptibilityProvenance(configHash: string, source: string = 'susceptibility'): Provenance {
  return {
    kind: 'derived',
    evidenceClass: 'remotely_sensed',
    methodology: 'Topographic Position Index (TPI) & raster sampling (Copernicus DEM GLO-30 30m, ESA WorldCover 2021 10m, OSM vectors)',
    source,
    fetchedAt: new Date().toISOString(),
    note: configHash,
  }
}

/**
 * Creates standardized provenance descriptor for relative risk calculation.
 */
export function createDerivedRiskProvenance(note: string = 'Relative waterlogging risk estimate based on frozen configuration matrix.'): Provenance {
  return {
    kind: 'derived',
    evidenceClass: 'model_derived',
    methodology: 'Multi-window Rainfall Trigger Index (RTI) & 2D decision matrix',
    source: 'NEXSTORM Multi-Window RTI & Risk Matrix Engine v1.0',
    fetchedAt: new Date().toISOString(),
    note,
  }
}

/**
 * Creates standardized provenance descriptor for historical meteorological reanalysis.
 */
export function createHistoricalReanalysisProvenance(source: string = 'Open-Meteo ERA5-Land Reanalysis Archive', note?: string): Provenance {
  return {
    kind: 'replay',
    evidenceClass: 'historical_reanalysis',
    methodology: 'ECMWF ERA5-Land hourly gridded atmospheric reanalysis (~11 km resolution)',
    source,
    fetchedAt: new Date().toISOString(),
    note: note || 'Retrospective meteorological reanalysis; not direct local rain gauge telemetry.',
  }
}

/**
 * Creates standardized provenance descriptor for official emergency broadcasts (CAP).
 */
export function createOfficialAlertProvenance(source: string = 'NDMA SACHET (CAP Feed)'): Provenance {
  return {
    kind: 'official',
    evidenceClass: 'official_record',
    methodology: 'Common Alerting Protocol (CAP) official emergency broadcast feed',
    source,
    fetchedAt: new Date().toISOString(),
    note: 'Official statutory alert issued by authorized disaster management authority.',
  }
}

/**
 * Creates standardized provenance descriptor for direct community observations or field inspections.
 */
export function createDirectObservationProvenance(source: string = 'Community Field Report', isVerified: boolean = false): Provenance {
  return {
    kind: isVerified ? 'official' : 'live',
    evidenceClass: isVerified ? 'official_record' : 'direct_observation',
    methodology: isVerified ? 'Authorized municipal field inspection' : 'Crowdsourced community observation report',
    source,
    fetchedAt: new Date().toISOString(),
    note: isVerified ? 'Verified direct field observation' : 'Unverified community report under review',
  }
}

/**
 * Creates standardized provenance descriptor for unavailable or degraded upstream data.
 */
export function createUnavailableDataProvenance(source: string, reason: string): Provenance {
  return {
    kind: 'derived',
    evidenceClass: 'missing_unavailable',
    methodology: 'Fail-closed missing data handler',
    source,
    fetchedAt: new Date().toISOString(),
    note: `DEGRADED / UNAVAILABLE — ${reason}. No fake data generated.`,
  }
}
