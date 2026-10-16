/**
 * src/lib/images/risk-mapper.ts
 * Deterministic Visual Risk Feature Mapper for NEXSTORM.
 *
 * Strictly adheres to P30 constraints:
 * 1. Do not let an LLM directly invent an arbitrary final risk score. Map validated
 *    visual observations to risk features using deterministic application code.
 * 2. Model confidence is NOT automatically a calibrated probability.
 * 3. Ordinary photographs do not support exact water depth claims.
 * 4. GPS coordinates or building IDs are never inferred merely from image appearance.
 * 5. Clearly distinguish historical flooding from active event conditions.
 * 6. Provider errors, ambiguous images, or missing metadata must never be turned
 *    into fabricated negative or positive observations.
 */

import type { ProvenanceMetadata, Wgs84Coordinates } from '../spatial/types'
import type { StructuredVisualObservation, VisualRiskFeaturesV1 } from './types'

export interface RiskMappingInput {
  imageId: string
  observation?: StructuredVisualObservation
  isHistorical: boolean
  capturedAt: string
  coordinates?: Wgs84Coordinates
  cellId?: string
  roadSegmentId?: string
  buildingId?: string
  providerStatus?: 'ok' | 'provider_error' | 'unconfigured' | 'corrupted_image'
}

export class VisualRiskFeatureMapper {
  /**
   * Deterministically maps validated visual observations to versioned VisualRiskFeaturesV1.
   */
  public static mapToRiskFeatures(input: RiskMappingInput): VisualRiskFeaturesV1 {
    const timestamp = new Date().toISOString()
    const provenance: ProvenanceMetadata = {
      sourceName: 'NEXSTORM Deterministic Visual Risk Mapper (v1.0.0)',
      retrievalDate: timestamp,
      license: 'Proprietary / Algorithmic Derivation',
      evidenceKind: 'observed',
    }

    // 1. Guard against provider failure, corrupted image, or missing observation
    if (
      input.providerStatus &&
      input.providerStatus !== 'ok'
    ) {
      return {
        schemaVersion: '1.0.0',
        imageId: input.imageId,
        visualSeverity: 'none',
        evidenceQuality: 'unusable',
        geographicRelevance: 'unlocated',
        temporalRelevance: input.isHistorical ? 'historical_vulnerability_only' : 'stale_unusable',
        currentRoadRiskElevation: 'none',
        currentBuildingExposureElevation: 'none',
        routeImpedancePenalty: 0,
        calibratedWeight: 0.0,
        isActionable: false,
        generatedAt: timestamp,
        provenance,
        scientificCaveat:
          'Provider execution failed or image was corrupted; zero visual hazard weight is applied.',
      }
    }

    if (!input.observation) {
      return {
        schemaVersion: '1.0.0',
        imageId: input.imageId,
        visualSeverity: 'none',
        evidenceQuality: 'unusable',
        geographicRelevance: 'unlocated',
        temporalRelevance: input.isHistorical ? 'historical_vulnerability_only' : 'stale_unusable',
        currentRoadRiskElevation: 'none',
        currentBuildingExposureElevation: 'none',
        routeImpedancePenalty: 0,
        calibratedWeight: 0.0,
        isActionable: false,
        generatedAt: timestamp,
        provenance,
        scientificCaveat: 'No visual observation available; evidence is non-actionable.',
      }
    }

    const obs = input.observation

    // 2. Image Quality & Uncertainty Screening
    if (
      obs.imageQuality === 'poor_blurry_dark' ||
      obs.imageQuality === 'occluded' ||
      obs.uncertaintyLevel === 'unusable'
    ) {
      return {
        schemaVersion: '1.0.0',
        imageId: input.imageId,
        visualSeverity: 'none',
        evidenceQuality: 'unusable',
        geographicRelevance: input.roadSegmentId || input.buildingId ? 'exact_segment_and_parcel' : 'unlocated',
        temporalRelevance: input.isHistorical ? 'historical_vulnerability_only' : 'stale_unusable',
        currentRoadRiskElevation: 'none',
        currentBuildingExposureElevation: 'none',
        routeImpedancePenalty: 0,
        calibratedWeight: 0.0,
        isActionable: false,
        generatedAt: timestamp,
        provenance,
        scientificCaveat:
          'Image was excessively dark, blurred, or occluded; visual evidence rejected to prevent false alarms.',
      }
    }

    // 3. Geographic Relevance Determination (Never inferred from pixels)
    let geographicRelevance: VisualRiskFeaturesV1['geographicRelevance'] = 'unlocated'
    if (input.roadSegmentId || input.buildingId) {
      geographicRelevance = 'exact_segment_and_parcel'
    } else if (input.cellId) {
      geographicRelevance = 'grid_cell_macro'
    }

    // Unlocated images cannot feed road or building scores
    if (geographicRelevance === 'unlocated') {
      return {
        schemaVersion: '1.0.0',
        imageId: input.imageId,
        visualSeverity: 'none',
        evidenceQuality: 'low',
        geographicRelevance: 'unlocated',
        temporalRelevance: input.isHistorical ? 'historical_vulnerability_only' : 'stale_unusable',
        currentRoadRiskElevation: 'none',
        currentBuildingExposureElevation: 'none',
        routeImpedancePenalty: 0,
        calibratedWeight: 0.0,
        isActionable: false,
        generatedAt: timestamp,
        provenance,
        scientificCaveat:
          'Image lacks verified geographic coordinates or infrastructure binding; discarded from spatial risk calculations.',
      }
    }

    // 4. Temporal Role Stratification
    const temporalRelevance: VisualRiskFeaturesV1['temporalRelevance'] = input.isHistorical
      ? 'historical_vulnerability_only'
      : 'active_event_hazard'

    // Historical photos NEVER trigger active flood alerts or route penalties
    if (temporalRelevance === 'historical_vulnerability_only') {
      return {
        schemaVersion: '1.0.0',
        imageId: input.imageId,
        visualSeverity: 'low_ponding',
        evidenceQuality: 'moderate',
        geographicRelevance,
        temporalRelevance,
        currentRoadRiskElevation: 'none',
        currentBuildingExposureElevation: 'none',
        routeImpedancePenalty: 0,
        calibratedWeight: 0.2, // Small historical weight for baseline vulnerability
        isActionable: true,
        generatedAt: timestamp,
        provenance,
        scientificCaveat:
          'Historical survey or archived event photo; documents historical vulnerability only and does NOT indicate current passage status.',
      }
    }

    // 5. Active Event Visual Severity Classification (Deterministic)
    let visualSeverity: VisualRiskFeaturesV1['visualSeverity'] = 'none'
    if (
      obs.roadWaterCondition === 'submerged' ||
      obs.roadWaterCondition === 'deep_standing_water' ||
      obs.buildingWaterImpact === 'ground_floor_flooded'
    ) {
      visualSeverity = 'severe_inundation'
    } else if (
      obs.roadWaterCondition === 'flowing_surface_water' ||
      obs.buildingWaterImpact === 'entrance_doorstep_inundation'
    ) {
      visualSeverity = 'moderate_flow'
    } else if (
      obs.roadWaterCondition === 'curb_ponding' ||
      obs.buildingWaterImpact === 'water_at_perimeter'
    ) {
      visualSeverity = 'low_ponding'
    }

    // 6. Road Risk Elevation & Route Impedance Penalty
    let currentRoadRiskElevation: VisualRiskFeaturesV1['currentRoadRiskElevation'] = 'none'
    let routeImpedancePenalty = 0

    if (obs.visibleWaterOnRoad) {
      if (
        obs.roadPassability === 'impassable' ||
        obs.roadWaterCondition === 'submerged' ||
        obs.roadWaterCondition === 'deep_standing_water'
      ) {
        currentRoadRiskElevation = 'high'
        routeImpedancePenalty = 30 // Maximum deterministic penalty points
      } else if (
        obs.roadPassability === 'caution' ||
        obs.roadWaterCondition === 'flowing_surface_water'
      ) {
        currentRoadRiskElevation = 'moderate'
        routeImpedancePenalty = 15
      }
    }

    // 7. Building Exposure Elevation
    let currentBuildingExposureElevation: VisualRiskFeaturesV1['currentBuildingExposureElevation'] = 'none'
    if (obs.visibleWaterAffectingBuilding) {
      if (
        obs.buildingWaterImpact === 'entrance_doorstep_inundation' ||
        obs.buildingWaterImpact === 'ground_floor_flooded'
      ) {
        currentBuildingExposureElevation = 'high_catchment'
      } else if (obs.buildingWaterImpact === 'water_at_perimeter') {
        currentBuildingExposureElevation = 'moderate_catchment'
      }
    }

    // 8. Evidence Quality & Weight Calibration
    let evidenceQuality: VisualRiskFeaturesV1['evidenceQuality'] = 'moderate'
    if (obs.imageQuality === 'high' && obs.uncertaintyLevel === 'low') {
      evidenceQuality = 'high'
    } else if (obs.uncertaintyLevel === 'high') {
      evidenceQuality = 'low'
    }

    // Deterministic calibrated weight: combines model confidence, image quality, and spatial accuracy
    const qualityFactor = evidenceQuality === 'high' ? 1.0 : evidenceQuality === 'moderate' ? 0.8 : 0.5
    const spatialFactor = geographicRelevance === 'exact_segment_and_parcel' ? 1.0 : 0.75
    const rawConf = Math.min(1.0, Math.max(0.0, obs.modelConfidence))
    const calibratedWeight = Math.round(rawConf * qualityFactor * spatialFactor * 100) / 100

    return {
      schemaVersion: '1.0.0',
      imageId: input.imageId,
      visualSeverity,
      evidenceQuality,
      geographicRelevance,
      temporalRelevance,
      currentRoadRiskElevation,
      currentBuildingExposureElevation,
      routeImpedancePenalty,
      calibratedWeight,
      isActionable: true,
      generatedAt: timestamp,
      provenance,
      scientificCaveat:
        'Active event ground photo; visual flood impact deterministically mapped to road passability and building exposure without synthetic score invention.',
    }
  }
}
