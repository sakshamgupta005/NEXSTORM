/**
 * src/lib/alerts/types.ts
 * Core types and data contracts for NEXSTORM P20 Alert Decision & Dispatch Subsystem.
 */

export type AlertSensitivity =
  | 'high_sensitivity'     // RTI >= 0.50
  | 'moderate_sensitivity' // RTI >= 0.75
  | 'high_risk'            // RTI >= 1.00
  | 'extreme'              // RTI >= 1.50

export type AlertDecisionState =
  | 'normal'
  | 'elevated_risk'
  | 'severe_risk'
  | 'stale_data'
  | 'unavailable_weather'
  | 'evaluation_failure'

export type AlertChannel = 'email' | 'sms' | 'webhook'

export type RolloutMode =
  | 'evaluation_only'
  | 'test_mode'
  | 'limited_rollout'
  | 'general_availability'

export interface WeatherFreshnessInfo {
  isStale: boolean
  fetchedAt: string
  ageSeconds: number
  source: string
}

export interface AlertDecision {
  decisionId: string
  cityId: string
  evaluatedAt: string
  state: AlertDecisionState
  sensitivity: AlertSensitivity
  thresholdApplied: number
  maxRti: number
  highestRiskCategory: 'low' | 'moderate' | 'high'
  weatherSource: string
  weatherFreshness: WeatherFreshnessInfo
  isDegraded: boolean
  permitted: boolean
  suppressionReason?: string
  reason: string
  affectedCells: string[]
  affectedRoadIds: string[]
  modelMetadata: {
    engineVersion: string
    configHash: string
  }
}

export interface GeofenceTarget {
  type: 'citywide' | 'cells' | 'corridor' | 'bbox'
  cellIds?: string[]
  roadCorridor?: string
  bbox?: [number, number, number, number] // [minLon, minLat, maxLon, maxLat]
}

export interface QuietHoursConfig {
  enabled: boolean
  startLocalHour: number // 0-23
  endLocalHour: number   // 0-23
  timezone: string       // e.g. 'Asia/Kolkata'
}

export interface SubscriberPreference {
  id: string
  cityId: string
  channel: AlertChannel
  destination: string
  sensitivity: AlertSensitivity
  geofence: GeofenceTarget
  quietHours?: QuietHoursConfig
  isOptedIn: boolean
  isVerified: boolean
  isTestSubscriber: boolean
  consentTimestamp: string
  unsubscribedAt?: string
  createdAt: string
  updatedAt: string
}

export interface AlertMessagePayload {
  alertType: 'modeled_risk_alert'
  alertId: string
  cityId: string
  severity: 'elevated' | 'severe'
  maxRti: number
  thresholdApplied: number
  affectedAreaDescription: string
  affectedCellsCount: number
  evaluatedAt: string
  weatherFreshnessNote: string
  safetyGuidance: string
  disclaimer: string
}

export interface DeliveryRecord {
  deliveryId: string
  decisionId: string
  subscriberId: string
  destination?: string
  idempotencyKey: string
  channel: AlertChannel
  status: 'pending' | 'delivered' | 'suppressed' | 'failed' | 'dead_letter'
  attemptCount: number
  maxAttempts: number
  isRetryable?: boolean
  nextRetryAt?: string
  lastAttemptAt?: string
  deliveredAt?: string
  failureReason?: string
  payload: AlertMessagePayload
  createdAt: string
  updatedAt: string
}

export interface DeliveryResult {
  success: boolean
  channel: AlertChannel
  providerName: string
  deliveredAt?: string
  error?: string
  isRetryable?: boolean
  isSimulation?: boolean
}
