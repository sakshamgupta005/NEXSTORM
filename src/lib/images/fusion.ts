/**
 * src/lib/images/fusion.ts
 * Deterministic Risk Fusion Engine for NEXSTORM.
 *
 * Implements P31 core calculation:
 * Fuses image-derived visual observations with verified base risk scores.
 *
 * Formula:
 *   R_final = clamp((1 - w * q) * R_base + (w * q) * R_visual, 0, 100)
 *
 * Variables:
 * - R_base: Verified base modeled risk score [0, 100].
 * - R_visual: Deterministic score derived from validated visual observations [0, 100].
 * - q: Evidence reliability [0.0, 1.0] factoring geolocation accuracy, distance,
 *      image quality, recency, uncertainty, and source validity.
 * - w: Configurable, conservative maximum visual contribution weight (default 0.35).
 *
 * Scientific Guardrails:
 * 1. Missing imagery must NEVER mean zero risk. When q = 0, R_final = R_base exactly.
 * 2. Asymmetric dampening: Dry photos must NOT strongly override credible rainfall or
 *    terrain susceptibility. If R_visual < R_base, visual weight is dampened by 75%
 *    and R_final cannot drop below 85% of R_base.
 * 3. Historical evidence (isHistorical: true or >24h old) is excluded from real-time
 *    hazard blending (q = 0 for active hazard) and tracked solely as historical vulnerability.
 * 4. Model confidence is not calibrated probability; it is modulated by spatial accuracy
 *    and image quality.
 */

import type { RoadImageEvidenceSummary, BuildingImageEvidenceSummary } from './types'

export interface FusionConfig {
  /**
   * Maximum visual contribution weight w.
   * Provisional default: 0.35 (conservative 35% maximum visual influence).
   */
  maxVisualWeight: number
  /**
   * Maximum acceptable distance in meters for building association.
   */
  buildingMaxDistanceMeters: number
  /**
   * Maximum acceptable distance in meters for road segment association.
   */
  roadMaxDistanceMeters: number
  /**
   * Cutoff age in hours for active storm evidence.
   */
  activeEvidenceCutoffHours: number
}

export const DEFAULT_FUSION_CONFIG: FusionConfig = {
  maxVisualWeight: 0.35,
  buildingMaxDistanceMeters: 35.0,
  roadMaxDistanceMeters: 25.0,
  activeEvidenceCutoffHours: 24.0,
}

export interface FusedRiskResult {
  /**
   * Final integrated risk score [0, 100].
   */
  rFinal: number
  /**
   * Verified base risk score [0, 100].
   */
  rBase: number
  /**
   * Visual risk score derived from image observation [0, 100].
   */
  rVisual: number
  /**
   * Evidence reliability factor q [0.0, 1.0].
   */
  q: number
  /**
   * Configurable maximum visual contribution weight w [0.0, 1.0].
   */
  w: number
  /**
   * Effective visual weight applied (w * q, with asymmetric dampening if dry) [0.0, 1.0].
   */
  effectiveWeight: number
  /**
   * Human-readable explanation of the fusion decision.
   */
  fusionReason: string
  /**
   * Flag indicating whether active image evidence meaningfully influenced the final score.
   */
  isVisuallyElevated: boolean
  /**
   * Count of active images contributing to the calculation.
   */
  activeImageCount: number
  /**
   * Count of historical survey images associated.
   */
  historicalImageCount: number
}

export class RiskFusionEngine {
  /**
   * Computes R_visual deterministically for road segments based on visual condition.
   */
  public static computeRoadVisualScore(evidence: RoadImageEvidenceSummary): number {
    const rf = evidence.riskFeatures
    if (rf) {
      if (rf.visualSeverity === 'severe_inundation') return 95
      if (rf.visualSeverity === 'moderate_flow') return 65
      if (rf.visualSeverity === 'low_ponding') return 35
      return 10
    }

    if (evidence.passability === 'impassable' || evidence.floodedRoad) return 90
    if (evidence.passability === 'caution') return 55
    return 10
  }

  /**
   * Computes R_visual deterministically for buildings based on visual impact.
   */
  public static computeBuildingVisualScore(evidence: BuildingImageEvidenceSummary): number {
    const rf = evidence.riskFeatures
    if (rf) {
      if (rf.visualSeverity === 'severe_inundation') return 95
      if (rf.visualSeverity === 'moderate_flow') return 75
      if (rf.visualSeverity === 'low_ponding') return 45
      return 10
    }

    if (evidence.floodedBuilding) return 85
    if (evidence.waterDetected) return 50
    return 10
  }

  /**
   * Evaluates reliability q for road image evidence [0.0, 1.0].
   */
  public static evaluateRoadReliability(
    evidence: RoadImageEvidenceSummary,
    distanceMeters: number = 0,
    config: FusionConfig = DEFAULT_FUSION_CONFIG
  ): number {
    // 1. Historical photos have ZERO reliability for active hazard blending
    if (evidence.isHistorical) return 0.0

    // 2. Age decay
    const ageHours = (Date.now() - Date.parse(evidence.capturedAt)) / (1000 * 60 * 60)
    if (isNaN(ageHours) || ageHours > config.activeEvidenceCutoffHours || ageHours < 0) {
      return 0.0
    }
    const qTime = ageHours <= 2 ? 1.0 : Math.max(0.2, 1.0 - (ageHours - 2) / 22)

    // 3. Distance decay relative to road segment
    const qDist = Math.max(0.0, 1.0 - distanceMeters / config.roadMaxDistanceMeters)
    if (qDist <= 0.0) return 0.0

    // 4. Quality & Uncertainty from risk features
    let qQuality = 0.8
    let qUncertainty = 0.8
    let modelConf = evidence.confidence ?? 0.8

    if (evidence.riskFeatures) {
      const rf = evidence.riskFeatures
      if (!rf.isActionable) return 0.0
      qQuality = rf.evidenceQuality === 'high' ? 1.0 : rf.evidenceQuality === 'moderate' ? 0.8 : 0.4
      qUncertainty = rf.calibratedWeight
      modelConf = rf.calibratedWeight
    }

    const q = Math.round(qDist * qTime * qQuality * modelConf * 100) / 100
    return Math.max(0.0, Math.min(1.0, q))
  }

  /**
   * Evaluates reliability q for building image evidence [0.0, 1.0].
   */
  public static evaluateBuildingReliability(
    evidence: BuildingImageEvidenceSummary,
    distanceMeters: number = 0,
    config: FusionConfig = DEFAULT_FUSION_CONFIG
  ): number {
    // 1. Historical photos have ZERO reliability for active real-time danger
    if (evidence.isHistorical) return 0.0

    // 2. Age decay
    const ageHours = (Date.now() - Date.parse(evidence.capturedAt)) / (1000 * 60 * 60)
    if (isNaN(ageHours) || ageHours > config.activeEvidenceCutoffHours || ageHours < 0) {
      return 0.0
    }
    const qTime = ageHours <= 2 ? 1.0 : Math.max(0.2, 1.0 - (ageHours - 2) / 22)

    // 3. Strict localized distance decay (prevents bleeding across the 250m cell)
    const qDist = Math.max(0.0, 1.0 - distanceMeters / config.buildingMaxDistanceMeters)
    if (qDist <= 0.0) return 0.0

    // 4. Quality & Uncertainty
    let qQuality = 0.8
    let modelConf = evidence.confidence ?? 0.8

    if (evidence.riskFeatures) {
      const rf = evidence.riskFeatures
      if (!rf.isActionable) return 0.0
      qQuality = rf.evidenceQuality === 'high' ? 1.0 : rf.evidenceQuality === 'moderate' ? 0.8 : 0.4
      modelConf = rf.calibratedWeight
    }

    const q = Math.round(qDist * qTime * qQuality * modelConf * 100) / 100
    return Math.max(0.0, Math.min(1.0, q))
  }

  /**
   * Fuses R_base and image evidence into R_final.
   */
  public static fuseRisk(params: {
    rBase: number
    visualScore: number
    reliability: number
    config?: Partial<FusionConfig>
  }): FusedRiskResult {
    const cfg: FusionConfig = { ...DEFAULT_FUSION_CONFIG, ...params.config }
    const rBase = Math.max(0, Math.min(100, params.rBase))
    const rVisual = Math.max(0, Math.min(100, params.visualScore))
    const q = Math.max(0, Math.min(1.0, params.reliability))
    const w = Math.max(0, Math.min(1.0, cfg.maxVisualWeight))

    // If no eligible evidence exists, base score is preserved exactly
    if (q <= 0.0 || w <= 0.0) {
      return {
        rFinal: Math.round(rBase),
        rBase: Math.round(rBase),
        rVisual: Math.round(rVisual),
        q: 0.0,
        w,
        effectiveWeight: 0.0,
        fusionReason: 'No eligible visual evidence; verified base model score preserved.',
        isVisuallyElevated: false,
        activeImageCount: 0,
        historicalImageCount: 0,
      }
    }

    let effectiveWeight = w * q

    // Asymmetric dampening: dry images cannot strongly override high modeled risk
    if (rVisual < rBase) {
      // Dampen visual weight by 75% for dry evidence
      effectiveWeight = effectiveWeight * 0.25
    }

    // Fusion formula: R_final = (1 - effectiveWeight) * R_base + effectiveWeight * R_visual
    let blended = (1.0 - effectiveWeight) * rBase + effectiveWeight * rVisual

    // Floor guardrail: dry photos cannot reduce risk below 85% of credible base score
    if (rVisual < rBase) {
      blended = Math.max(blended, rBase * 0.85)
    }

    const rFinal = Math.max(0, Math.min(100, Math.round(blended)))
    const isVisuallyElevated = rFinal > rBase

    let fusionReason = 'Visual evidence integrated with base model.'
    if (isVisuallyElevated) {
      fusionReason = `Elevated by +${rFinal - rBase} pts due to validated visual flood evidence (q=${q.toFixed(2)}).`
    } else if (rVisual < rBase) {
      fusionReason = `Modeled risk maintained; visual dryness observed but conservatively bounded (q=${q.toFixed(2)}).`
    }

    return {
      rFinal,
      rBase: Math.round(rBase),
      rVisual: Math.round(rVisual),
      q,
      w,
      effectiveWeight: Math.round(effectiveWeight * 1000) / 1000,
      fusionReason,
      isVisuallyElevated,
      activeImageCount: q > 0 ? 1 : 0,
      historicalImageCount: 0,
    }
  }
}
