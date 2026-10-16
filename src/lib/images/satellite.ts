/**
 * src/lib/images/satellite.ts
 * Satellite Remote Sensing Feasibility & Suitability Evaluator for NEXSTORM.
 *
 * Investigates openly accessible satellite imagery (Copernicus Sentinel-1/2, Landsat)
 * and determines suitability for urban street-level and building-level waterlogging.
 *
 * Scientific Guardrail:
 * Open satellite constellations provide critical regional macro-hydrological data, but
 * are fundamentally limited by cloud cover, revisit latency, and spatial resolution
 * during rapid urban flash floods. We document these limits honestly rather than
 * pretending satellite sensors provide real-time 1-hour street inundation views.
 */

import type { SatelliteSuitabilityAssessment } from './types'

export class SatelliteRemoteSensingService {
  private static instance: SatelliteRemoteSensingService

  private constructor() {}

  public static getInstance(): SatelliteRemoteSensingService {
    if (!SatelliteRemoteSensingService.instance) {
      SatelliteRemoteSensingService.instance = new SatelliteRemoteSensingService()
    }
    return SatelliteRemoteSensingService.instance
  }

  /**
   * Produces scientific suitability assessments for candidate open satellite constellations.
   */
  public evaluateConstellations(): SatelliteSuitabilityAssessment[] {
    const timestamp = new Date().toISOString()

    return [
      {
        sensor: 'Sentinel-2 Multispectral Instrument (MSI)',
        constellation: 'Copernicus Sentinel-2 (ESA)',
        spatialResolutionM: 10.0,
        revisitIntervalDays: 5,
        cloudPenetration: false,
        urbanStreetFeasibility: 'unsuitable',
        rationale:
          'Optical multispectral bands (B2, B3, B4, B8 at 10m) cannot penetrate dense monsoon storm clouds during cloudbursts. Furthermore, 10m ground sampling distance cannot resolve narrow 3-8m urban streets in Amritsar and Jalandhar without severe mixed-pixel spectral contamination.',
        limitations: [
          '100% obscured by cloud cover during active extreme rainfall events',
          '5-day revisit latency exceeds rapid urban drainage event horizon (< 6 hours)',
          '10m pixel width exceeds carriageway width of tertiary and residential streets',
        ],
        recommendedUsage:
          'Post-event regional catchment delta analysis and reservoir/canal overflow mapping once cloud cover dissipates.',
        assessedAt: timestamp,
      },
      {
        sensor: 'Sentinel-1 Synthetic Aperture Radar (C-SAR)',
        constellation: 'Copernicus Sentinel-1 (ESA)',
        spatialResolutionM: 20.0,
        revisitIntervalDays: 12,
        cloudPenetration: true,
        urbanStreetFeasibility: 'unsuitable',
        rationale:
          'While C-band SAR successfully penetrates heavy cloud cover and precipitation, high-density urban street canyons produce intense radar double-bounce reflections between vertical masonry walls and street surfaces, masking specular water signatures.',
        limitations: [
          '12-day orbital revisit over Punjab prevents real-time early warning',
          'Urban corner-reflector artifacts create catastrophic false-negative rates in street canyons',
          'Ground range detected (GRD) resolution (~20m) aggregates multiple building parcels per pixel',
        ],
        recommendedUsage:
          'Regional rural riverine flood extent mapping along the Ravi and Beas river basins.',
        assessedAt: timestamp,
      },
      {
        sensor: 'Landsat 8/9 Operational Land Imager (OLI)',
        constellation: 'USGS / NASA Landsat',
        spatialResolutionM: 30.0,
        revisitIntervalDays: 8,
        cloudPenetration: false,
        urbanStreetFeasibility: 'unsuitable',
        rationale:
          '30m multispectral resolution is an order of magnitude coarser than urban infrastructure elements. Cloud blindness during the South Asian monsoon precludes tactical operations.',
        limitations: [
          '30m resolution aggregates entire city blocks into single pixels',
          '8-16 day revisit cycle',
          'Complete optical opacity during rainstorms',
        ],
        recommendedUsage: 'Long-term decadal urban impervious surface expansion modeling.',
        assessedAt: timestamp,
      },
    ]
  }

  /**
   * Evaluates whether satellite imagery is legally and practically usable for current street/building risk.
   */
  public isSuitableForRealTimeUrbanRisk(): {
    suitable: boolean
    primaryReason: string
    preferredAlternative: string
  } {
    return {
      suitable: false,
      primaryReason:
        'Optical satellite sensors suffer 100% cloud blindness during monsoon cloudbursts, and SAR sensors suffer urban canyon double-bounce with 6-12 day revisit latency. Real-time urban street/building waterlogging requires sub-meter ground-truth and street-level evidence.',
      preferredAlternative:
        'Street-level georeferenced observations (Mapillary baseline infrastructure + verified citizen/field incident reports).',
    }
  }
}

export const satelliteRemoteSensingService = SatelliteRemoteSensingService.getInstance()
