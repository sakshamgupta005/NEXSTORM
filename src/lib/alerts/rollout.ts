/**
 * src/lib/alerts/rollout.ts
 * Operational rollout controls, operator kill switch, and strict message taxonomy.
 */

import type { AlertDecision, AlertMessagePayload, RolloutMode, SubscriberPreference } from './types'

export const DEFAULT_ROLLOUT_MODE: RolloutMode = 'evaluation_only'

/**
 * Gets the current active rollout mode from environment configuration.
 * Defaults strictly to 'evaluation_only' unless explicitly overridden.
 */
export function getRolloutMode(): RolloutMode {
  const envMode = process.env.DISPATCH_ROLLOUT_MODE?.toLowerCase()

  if (envMode === 'test_mode') return 'test_mode'
  if (envMode === 'limited_rollout') return 'limited_rollout'
  if (envMode === 'general_availability') {
    // GA requires explicit dual-confirmation
    if (process.env.DISPATCH_GA_ENABLED === 'true') {
      return 'general_availability'
    }
    return 'limited_rollout'
  }

  return 'evaluation_only'
}

/**
 * Checks whether the operator emergency kill switch is activated.
 * When active, all outbound notifications are suppressed immediately.
 */
export function isKillSwitchActive(): boolean {
  return process.env.DISPATCH_KILL_SWITCH === 'true'
}

/**
 * Checks whether a given subscriber is permitted to receive notifications under current rollout mode.
 */
export function isDeliveryPermittedForSubscriber(
  subscriber: SubscriberPreference,
  rolloutMode: RolloutMode = getRolloutMode()
): { permitted: boolean; reason: string } {
  // 1. Kill switch overrides everything
  if (isKillSwitchActive()) {
    return { permitted: false, reason: 'Suppressed: Operator emergency kill switch (DISPATCH_KILL_SWITCH) is active.' }
  }

  // 2. Subscriber must be opted in
  if (!subscriber.isOptedIn) {
    return { permitted: false, reason: 'Suppressed: Subscriber has opted out or unsubscribed.' }
  }

  // 3. Rollout mode checks
  if (rolloutMode === 'evaluation_only') {
    return {
      permitted: false,
      reason: 'Suppressed: Dispatch engine is operating in evaluation_only mode; decisions recorded without dispatch.',
    }
  }

  if (rolloutMode === 'test_mode') {
    if (!subscriber.isTestSubscriber) {
      return {
        permitted: false,
        reason: 'Suppressed: Dispatch engine is in test_mode; non-test subscribers are excluded.',
      }
    }
    return { permitted: true, reason: 'Permitted: Test subscriber authorized under test_mode.' }
  }

  if (rolloutMode === 'limited_rollout') {
    // Requires verified destination or verified consent
    if (!subscriber.isVerified && !subscriber.isTestSubscriber) {
      return {
        permitted: false,
        reason: 'Suppressed: Limited rollout requires verified contact destination status.',
      }
    }
    return { permitted: true, reason: 'Permitted: Verified subscriber authorized under limited_rollout.' }
  }

  if (rolloutMode === 'general_availability') {
    return { permitted: true, reason: 'Permitted: General availability active.' }
  }

  return { permitted: false, reason: 'Suppressed: Unrecognized rollout state.' }
}

/**
 * Assembles an authoritative AlertMessagePayload enforcing the modeled_risk_alert taxonomy.
 * Strictly avoids conflating modeled hazard with physically confirmed flood inundation.
 */
export function createAlertMessagePayload(
  decision: AlertDecision,
  areaDescription: string = 'Amritsar Municipal Perimeter'
): AlertMessagePayload {
  const isSevere = decision.state === 'severe_risk' || decision.maxRti >= 1.5

  const safetyGuidance = isSevere
    ? 'Severe modeled rainfall hazard: Avoid travel through railway underpasses (SSSS Chowk), Walled City gates, and low-lying arterial corridors. Do not enter standing water.'
    : 'Elevated modeled hazard: Slow down on arterial corridors. Watch for localized water accumulation in commercial bazaars and low-lying underpasses.'

  return {
    alertType: 'modeled_risk_alert',
    alertId: decision.decisionId,
    cityId: decision.cityId,
    severity: isSevere ? 'severe' : 'elevated',
    maxRti: decision.maxRti,
    thresholdApplied: decision.thresholdApplied,
    affectedAreaDescription: areaDescription,
    affectedCellsCount: decision.affectedCells.length,
    evaluatedAt: decision.evaluatedAt,
    weatherFreshnessNote: `Weather input: ${decision.weatherSource} (age: ${decision.weatherFreshness.ageSeconds}s, degraded: ${decision.isDegraded})`,
    safetyGuidance,
    disclaimer:
      'NEXSTORM Modeled Risk Alert: Elevated waterlogging hazard modeled based on rainfall and terrain susceptibility. ' +
      'This is NOT a confirmed observation of flooding or flood depth, and does NOT replace official PSDMA / IMD emergency advisories.',
  }
}
