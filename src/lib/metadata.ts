/**
 * src/lib/metadata.ts
 * Standardized Human-Readable Data Metadata & Value-Level Warning System.
 *
 * Implements concise, understandable metadata contracts so non-technical users
 * can instantly tell whether a value is an observation, reanalysis, estimate,
 * simulation, or unavailable data.
 */

export type ValueSourceCategory =
  | 'Observed'
  | 'Historical reanalysis'
  | 'Estimated'
  | 'Simulated value'
  | 'Unavailable'

export interface ValueMeta {
  label: string
  status: ValueSourceCategory
  explanation: string
  unit?: string
  freshness?: string
  source?: string
}

export function createValueMeta(meta: ValueMeta): ValueMeta {
  return meta
}

/**
 * Standard plain-language metadata builders for core NEXSTORM indicators.
 */
export const ValueMetaPresets = {
  /**
   * Topographic runoff susceptibility score S in [0, 1].
   */
  susceptibility: (sourceNote?: string): ValueMeta => ({
    label: 'Relative Waterlogging Susceptibility',
    status: 'Estimated',
    unit: 'index (0–1)',
    explanation:
      'Relative susceptibility of terrain to waterlogging based on elevation depression, slope, and land cover. Not a flood depth or calibrated probability.',
    source: sourceNote || 'Copernicus DEM (30m) & ESA WorldCover (10m)',
  }),

  /**
   * Waterlogging risk classification (low, moderate, high).
   */
  riskClass: (mode: 'live' | 'replay' | 'scenario' = 'live'): ValueMeta => ({
    label: 'Waterlogging Risk Level',
    status: mode === 'replay' ? 'Estimated' : mode === 'scenario' ? 'Simulated value' : 'Estimated',
    explanation:
      'Estimated relative hazard band derived from precipitation accumulation and topographic susceptibility. Does not guarantee localized street inundation.',
    source: 'NEXSTORM Multi-Window Decision Matrix',
  }),

  /**
   * Rainfall Trigger Index (RTI).
   */
  rti: (mode: 'live' | 'replay' | 'scenario' = 'live'): ValueMeta => ({
    label: 'Rainfall Trigger Ratio',
    status: mode === 'replay' ? 'Historical reanalysis' : mode === 'scenario' ? 'Simulated value' : 'Estimated',
    unit: 'ratio',
    explanation:
      'Ratio comparing multi-window rainfall accumulation against localized baseline thresholds. Values above 1.0 indicate elevated waterlogging propensity.',
    source: 'NEXSTORM Trigger Engine',
  }),

  /**
   * 24-hour rainfall accumulation.
   */
  rainfall24h: (
    mode: 'live' | 'replay' | 'scenario' = 'live',
    freshness?: string,
    source?: string
  ): ValueMeta => {
    switch (mode) {
      case 'live':
        return {
          label: 'Forecast 24h Rainfall',
          status: 'Estimated',
          unit: 'mm',
          explanation:
            'Forecast total from numerical atmospheric prediction models (Open-Meteo/ECMWF); not a rain-gauge observation.',
          freshness: freshness || 'Latest model run',
          source: source || 'Numerical Weather Forecast',
        }
      case 'replay':
        return {
          label: 'Historical 24h Rainfall',
          status: 'Historical reanalysis',
          unit: 'mm',
          explanation:
            'Atmospheric reconstruction from ERA5-Land reanalysis archive; not an in-situ rain gauge measurement.',
          freshness: freshness || 'Archived meteorological record',
          source: source || 'ECMWF ERA5-Land Reanalysis',
        }
      case 'scenario':
        return {
          label: 'Simulated 24h Rainfall',
          status: 'Simulated value',
          unit: 'mm',
          explanation:
            'Synthetic precipitation accumulation generated from a hypothetical storm scenario for stress-testing.',
          freshness: 'User-configured scenario',
          source: source || 'NEXSTORM Hyetograph Generator',
        }
    }
  },

  /**
   * Peak 1-hour rainfall rate.
   */
  rainfall1h: (
    mode: 'live' | 'replay' | 'scenario' = 'live',
    freshness?: string,
    source?: string
  ): ValueMeta => {
    switch (mode) {
      case 'live':
        return {
          label: 'Peak 1h Rainfall Rate',
          status: 'Estimated',
          unit: 'mm/h',
          explanation:
            'Highest expected 1-hour rainfall rate during the forecast window. Reflects short convective pulses.',
          freshness: freshness || 'Latest model run',
          source: source || 'Numerical Weather Forecast',
        }
      case 'replay':
        return {
          label: 'Historical Peak 1h Rate',
          status: 'Historical reanalysis',
          unit: 'mm/h',
          explanation:
            'Highest reconstructed 1-hour rainfall rate in the historical reanalysis time series.',
          freshness: freshness || 'Archived record',
          source: source || 'ECMWF ERA5-Land Reanalysis',
        }
      case 'scenario':
        return {
          label: 'Simulated Peak 1h Rate',
          status: 'Simulated value',
          unit: 'mm/h',
          explanation:
            'Configured peak 1-hour precipitation intensity for the synthetic storm simulation.',
          freshness: 'User-configured scenario',
          source: source || 'NEXSTORM Hyetograph Generator',
        }
    }
  },

  /**
   * IMD Rainfall Category.
   */
  imdCategory: (): ValueMeta => ({
    label: 'Rainfall Intensity Standard',
    status: 'Estimated',
    explanation:
      'Official India Meteorological Department (IMD) classification based on predicted 24h accumulation (e.g. Moderate, Heavy, Very Heavy).',
    source: 'IMD Meteorological Standard Criteria',
  }),

  /**
   * Official emergency alert (e.g. SACHET CAP broadcast).
   */
  officialAlert: (source?: string, freshness?: string): ValueMeta => ({
    label: 'Statutory Emergency Alert',
    status: 'Observed',
    explanation:
      'Authoritative disaster warning broadcast issued by government emergency agencies under Common Alerting Protocol (CAP).',
    freshness: freshness || 'Active government feed',
    source: source || 'NDMA SACHET (Government of India)',
  }),

  /**
   * Field observation or crowdsourced report.
   */
  observation: (isVerified: boolean = false, isArchivedNews: boolean = false): ValueMeta => ({
    label: isArchivedNews ? 'Documented News Waterlogging Report' : 'Waterlogging Field Report',
    status: 'Observed',
    explanation: isArchivedNews
      ? 'Historical event documented in newspaper archives (The Tribune); not an in-situ rain gauge measurement.'
      : isVerified
      ? 'Direct field observation inspected and verified by municipal coordinators.'
      : 'Community-submitted observation under review. Subject to citizen reporter verification.',
    source: isArchivedNews ? 'The Tribune Archival Records' : isVerified ? 'Municipal Field Inspection' : 'Community Submission',
  }),

  /**
   * Building catchment exposure.
   */
  buildingExposure: (): ValueMeta => ({
    label: 'Building Catchment Exposure',
    status: 'Estimated',
    explanation:
      'Spatial geometric intersection of building footprints with 250m runoff catchment cells. Does not predict foundation damage or indoor water depth.',
    source: 'Google Open Buildings V3 & NEXSTORM 250m Grid',
  }),

  /**
   * Road corridor flood risk.
   */
  roadRisk: (): ValueMeta => ({
    label: 'Road Inundation Propensity',
    status: 'Estimated',
    explanation:
      'Corridor runoff risk combining adjacent terrain depression and underpass proximity. Assumes 30 km/h baseline without live traffic data.',
    source: 'OpenStreetMap Vectors & Terrain Susceptibility',
  }),

  /**
   * Historical reanalysis weather or record.
   */
  historicalReanalysis: (label: string, explanation?: string, unit?: string): ValueMeta => ({
    label,
    status: 'Historical reanalysis',
    unit,
    explanation:
      explanation ||
      'Atmospheric reconstruction from ERA5-Land reanalysis archive; not a direct rain-gauge measurement.',
    freshness: 'Archived meteorological record',
    source: 'ECMWF ERA5-Land Reanalysis',
  }),

  /**
   * Evaluation metric (e.g. Probability of Detection / Alert days).
   */
  evaluationMetric: (metricName: string, unit?: string): ValueMeta => ({
    label: metricName,
    status: 'Historical reanalysis',
    unit,
    explanation:
      'Computed retrospectively by evaluating model thresholds against historical reanalysis weather and documented event dates.',
    source: 'NEXSTORM Offline Backtest Engine',
  }),

  /**
   * Unavailable or degraded metric.
   */
  unavailable: (label: string, reason: string): ValueMeta => ({
    label,
    status: 'Unavailable',
    explanation: `Data is unavailable: ${reason}. Silently substituting fake numbers is strictly prohibited.`,
    freshness: 'Unavailable',
  }),
}
