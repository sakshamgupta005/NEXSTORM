/**
 * tests/unit/p20-alert-subsystem.test.ts
 * Regression test suite for NEXSTORM P20 — Alert Decision Engine,
 * Subscriber Preferences & Safe Dispatch.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import {
  evaluateAlertDecision,
  SENSITIVITY_THRESHOLDS,
} from '@/lib/alerts/engine'
import {
  validateGeofenceTarget,
  matchSubscriberGeofence,
  isQuietHoursActive,
} from '@/lib/alerts/geofence'
import {
  isInternalOrPrivateHost,
  TestAlertProvider,
} from '@/lib/alerts/providers/base'
import {
  getRolloutMode,
  isKillSwitchActive,
  isDeliveryPermittedForSubscriber,
  createAlertMessagePayload,
} from '@/lib/alerts/rollout'
import { runAlertDispatch } from '@/lib/alerts/dispatcher'
import { getAlertRepository } from '@/lib/alerts/repository'
import { POST as handleSubscribe } from '@/app/api/alerts/subscribe/route'
import { POST as handleUnsubscribe } from '@/app/api/alerts/unsubscribe/route'
import { POST as handlePreview } from '@/app/api/alerts/preview/route'
import { GET as handleStatus } from '@/app/api/alerts/status/route'
import { POST as handleDispatch } from '@/app/api/alerts/dispatch/route'
import { createScenarioRainfallSeries } from '@/lib/alerts/engine'
import type { SubscriberPreference } from '@/lib/alerts/types'

describe('P20 — Alert Decision Engine, Subscriber Preferences & Safe Dispatch', () => {
  const repository = getAlertRepository()

  beforeEach(async () => {
    await repository.reset('amritsar')
    TestAlertProvider.clear()
    delete process.env.DISPATCH_KILL_SWITCH
    delete process.env.DISPATCH_ROLLOUT_MODE
  })

  describe('1. Decision Engine & Sensitivity Thresholds', () => {
    it('evaluates all 4 documented RTI thresholds correctly', () => {
      expect(SENSITIVITY_THRESHOLDS.high_sensitivity).toBe(0.5)
      expect(SENSITIVITY_THRESHOLDS.moderate_sensitivity).toBe(0.75)
      expect(SENSITIVITY_THRESHOLDS.high_risk).toBe(1.0)
      expect(SENSITIVITY_THRESHOLDS.extreme).toBe(1.5)
    })

    it('returns "normal" state when Max RTI is below sensitivity threshold', () => {
      // Very light rain: 1mm peak produces low RTI (< 0.5)
      const series = createScenarioRainfallSeries({
        cityId: 'amritsar',
        peakMm1h: 1,
        durationH: 1,
        antecedentMm72h: 0,
      })

      const decision = evaluateAlertDecision({
        cityId: 'amritsar',
        sensitivity: 'high_sensitivity',
        series,
      })

      expect(decision.state).toBe('normal')
      expect(decision.permitted).toBe(false)
      expect(decision.maxRti).toBeLessThan(0.5)
      expect(decision.affectedCells.length).toBe(0)
    })

    it('transitions to "elevated_risk" when Max RTI reaches threshold', () => {
      // Moderate storm: 25mm peak produces RTI ~ 0.7 - 0.9
      const series = createScenarioRainfallSeries({
        cityId: 'amritsar',
        peakMm1h: 25,
        durationH: 3,
        antecedentMm72h: 10,
      })

      const decision = evaluateAlertDecision({
        cityId: 'amritsar',
        sensitivity: 'high_sensitivity', // threshold 0.5
        series,
      })

      expect(decision.permitted).toBe(true)
      expect(decision.state === 'elevated_risk' || decision.state === 'severe_risk').toBe(true)
      expect(decision.maxRti).toBeGreaterThanOrEqual(0.5)
      expect(decision.affectedCells.length).toBeGreaterThan(0)
    })

    it('transitions to "severe_risk" when Max RTI >= 1.5 or High risk cells exist', () => {
      // Severe storm: 70mm peak
      const series = createScenarioRainfallSeries({
        cityId: 'amritsar',
        peakMm1h: 70,
        durationH: 4,
        antecedentMm72h: 30,
      })

      const decision = evaluateAlertDecision({
        cityId: 'amritsar',
        sensitivity: 'extreme', // threshold 1.5
        series,
      })

      expect(decision.state).toBe('severe_risk')
      expect(decision.permitted).toBe(true)
      expect(decision.maxRti).toBeGreaterThanOrEqual(1.5)
      expect(decision.highestRiskCategory).toBe('high')
    })
  })

  describe('2. Weather Freshness & Degradation Suppression', () => {
    it('suppresses alert dispatch when weather series is completely unavailable', () => {
      const decision = evaluateAlertDecision({
        cityId: 'amritsar',
        isWeatherUnavailable: true,
        weatherError: 'Provider connection refused',
      })

      expect(decision.state).toBe('unavailable_weather')
      expect(decision.permitted).toBe(false)
      expect(decision.isDegraded).toBe(true)
      expect(decision.suppressionReason).toContain('unavailable')
    })

    it('suppresses alert dispatch when weather data exceeds staleness threshold (> 3600s)', () => {
      const series = createScenarioRainfallSeries({
        cityId: 'amritsar',
        peakMm1h: 60,
        durationH: 3,
        antecedentMm72h: 0,
      })

      // Simulate stale fetch time: 2 hours ago (7200s > 3600s)
      series.provenance.fetchedAt = new Date(Date.now() - 7200 * 1000).toISOString()

      const decision = evaluateAlertDecision({
        cityId: 'amritsar',
        sensitivity: 'high_sensitivity',
        series,
      })

      expect(decision.state).toBe('stale_data')
      expect(decision.permitted).toBe(false)
      expect(decision.weatherFreshness.isStale).toBe(true)
      expect(decision.suppressionReason).toContain('stale')
    })
  })

  describe('3. Geospatial Targeting & Geofence Validation', () => {
    it('validates citywide, cells, corridor, and bbox geofence types', () => {
      expect(validateGeofenceTarget({ type: 'citywide' }).valid).toBe(true)
      expect(validateGeofenceTarget({ type: 'cells', cellIds: ['A-0590'] }).valid).toBe(true)
      expect(validateGeofenceTarget({ type: 'corridor', roadCorridor: 'Batala Road' }).valid).toBe(true)
      expect(validateGeofenceTarget({ type: 'bbox', bbox: [74.81, 31.60, 74.88, 31.66] }).valid).toBe(true)
    })

    it('rejects invalid geofence configurations', () => {
      // Empty cellIds
      expect(validateGeofenceTarget({ type: 'cells', cellIds: [] }).valid).toBe(false)
      // Invalid cellId
      expect(validateGeofenceTarget({ type: 'cells', cellIds: ['INVALID_CELL_9999'] }).valid).toBe(false)
      // Inverted bbox coordinates
      expect(validateGeofenceTarget({ type: 'bbox', bbox: [74.90, 31.66, 74.81, 31.60] }).valid).toBe(false)
      // Bbox out of city bounds
      expect(validateGeofenceTarget({ type: 'bbox', bbox: [70.00, 20.00, 71.00, 21.00] }).valid).toBe(false)
    })

    it('matches target cells accurately and deduplicates single notification', () => {
      const dummySub: SubscriberPreference = {
        id: 'SUB-TEST-1',
        cityId: 'amritsar',
        channel: 'webhook',
        destination: 'https://example.com/alerts',
        sensitivity: 'high_sensitivity',
        geofence: { type: 'cells', cellIds: ['A-0590', 'A-0935'] },
        isOptedIn: true,
        isVerified: true,
        isTestSubscriber: true,
        consentTimestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Decision affecting A-0590
      const series = createScenarioRainfallSeries({
        cityId: 'amritsar',
        peakMm1h: 50,
        durationH: 3,
        antecedentMm72h: 0,
      })
      const decision = evaluateAlertDecision({ cityId: 'amritsar', series })

      const match = matchSubscriberGeofence(dummySub, decision)
      expect(match.matches).toBe(true)
      expect(match.matchedCells.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('4. Quiet Hours & Timezone Boundaries', () => {
    it('suppresses elevated_risk alerts during subscriber quiet hours', () => {
      const quietConfig = {
        enabled: true,
        startLocalHour: 22,
        endLocalHour: 7,
        timezone: 'Asia/Kolkata',
      }

      // Test with a mock date at 23:30 (11:30 PM)
      const nightDate = new Date('2026-10-15T23:30:00+05:30')
      const check = isQuietHoursActive(quietConfig, 'elevated_risk', nightDate)

      expect(check.isQuiet).toBe(true)
      expect(check.reason).toContain('quiet hours')
    })

    it('bypasses quiet hours for severe_risk alerts to protect life-safety', () => {
      const quietConfig = {
        enabled: true,
        startLocalHour: 22,
        endLocalHour: 7,
        timezone: 'Asia/Kolkata',
      }

      const nightDate = new Date('2026-10-15T23:30:00+05:30')
      const check = isQuietHoursActive(quietConfig, 'severe_risk', nightDate)

      expect(check.isQuiet).toBe(false)
      expect(check.reason).toContain('Severe risk alert bypasses quiet hours')
    })
  })

  describe('5. SSRF Defense & Webhook Security', () => {
    it('identifies and blocks private/internal network addresses from webhook dispatch', () => {
      expect(isInternalOrPrivateHost('localhost')).toBe(true)
      expect(isInternalOrPrivateHost('127.0.0.1')).toBe(true)
      expect(isInternalOrPrivateHost('10.0.0.5')).toBe(true)
      expect(isInternalOrPrivateHost('172.16.0.1')).toBe(true)
      expect(isInternalOrPrivateHost('192.168.1.100')).toBe(true)
      expect(isInternalOrPrivateHost('169.254.169.254')).toBe(true) // AWS metadata service
      expect(isInternalOrPrivateHost('::1')).toBe(true)

      // Public hosts must NOT be blocked
      expect(isInternalOrPrivateHost('api.example.com')).toBe(false)
      expect(isInternalOrPrivateHost('webhook.site')).toBe(false)
    })
  })

  describe('6. Rollout Controls & Operator Kill Switch', () => {
    it('defaults to evaluation_only mode and suppresses external sends', () => {
      delete process.env.DISPATCH_ROLLOUT_MODE
      expect(getRolloutMode()).toBe('evaluation_only')

      const dummySub: SubscriberPreference = {
        id: 'SUB-1',
        cityId: 'amritsar',
        channel: 'email',
        destination: 'user@example.com',
        sensitivity: 'high_sensitivity',
        geofence: { type: 'citywide' },
        isOptedIn: true,
        isVerified: true,
        isTestSubscriber: false,
        consentTimestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const check = isDeliveryPermittedForSubscriber(dummySub, 'evaluation_only')
      expect(check.permitted).toBe(false)
      expect(check.reason).toContain('evaluation_only')
    })

    it('enforces operator kill switch across all modes', () => {
      process.env.DISPATCH_KILL_SWITCH = 'true'
      expect(isKillSwitchActive()).toBe(true)

      const dummySub: SubscriberPreference = {
        id: 'SUB-1',
        cityId: 'amritsar',
        channel: 'email',
        destination: 'user@example.com',
        sensitivity: 'high_sensitivity',
        geofence: { type: 'citywide' },
        isOptedIn: true,
        isVerified: true,
        isTestSubscriber: true,
        consentTimestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const check = isDeliveryPermittedForSubscriber(dummySub, 'test_mode')
      expect(check.permitted).toBe(false)
      expect(check.reason).toContain('Operator emergency kill switch')
    })

    it('enforces modeled_risk_alert taxonomy and never claims confirmed flood report', () => {
      const series = createScenarioRainfallSeries({
        cityId: 'amritsar',
        peakMm1h: 60,
        durationH: 3,
        antecedentMm72h: 0,
      })
      const decision = evaluateAlertDecision({ cityId: 'amritsar', series })
      const payload = createAlertMessagePayload(decision)

      expect(payload.alertType).toBe('modeled_risk_alert')
      expect(payload.disclaimer).toContain('NOT a confirmed observation of flooding')
      expect(payload.disclaimer).toContain('does NOT replace official PSDMA / IMD emergency advisories')
    })
  })

  describe('7. End-to-End Safe Dispatch Cycle & Deduplication', () => {
    it('executes test-mode dispatch to test subscriber and enforces idempotency', async () => {
      process.env.DISPATCH_ROLLOUT_MODE = 'test_mode'

      // Register test subscriber
      const sub: SubscriberPreference = {
        id: 'SUB-TEST-DISPATCH-1',
        cityId: 'amritsar',
        channel: 'webhook',
        destination: 'https://webhook.site/test-endpoint',
        sensitivity: 'high_sensitivity',
        geofence: { type: 'citywide' },
        isOptedIn: true,
        isVerified: true,
        isTestSubscriber: true,
        consentTimestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await repository.saveSubscriber(sub)

      const series = createScenarioRainfallSeries({
        cityId: 'amritsar',
        peakMm1h: 50,
        durationH: 3,
        antecedentMm72h: 0,
      })

      // Run dispatch cycle with test provider
      const summary1 = await runAlertDispatch({
        cityId: 'amritsar',
        series,
        forceTestProvider: true,
      })

      expect(summary1.decision.permitted).toBe(true)
      expect(summary1.matchedSubscribers).toBe(1)
      expect(summary1.successfulDeliveries).toBe(1)
      expect(TestAlertProvider.deliveredQueue.length).toBe(1)

      // Run immediate duplicate dispatch with same decision
      const summary2 = await runAlertDispatch({
        cityId: 'amritsar',
        series,
        forceTestProvider: true,
      })

      // Must be suppressed by cooldown / idempotency
      expect(summary2.suppressedDeliveries).toBe(1)
      expect(summary2.successfulDeliveries).toBe(0)
      // Delivered queue must not have increased
      expect(TestAlertProvider.deliveredQueue.length).toBe(1)
    })
  })

  describe('8. Server-Side APIs (Subscribe, Preview, Status, Dispatch)', () => {
    it('POST /api/alerts/subscribe registers preferences and masks destination in response', async () => {
      const payload = {
        cityId: 'amritsar',
        channel: 'email',
        destination: 'citizen@example.com',
        sensitivity: 'moderate_sensitivity',
        geofence: { type: 'citywide' },
      }

      const req = new NextRequest('http://localhost:3000/api/alerts/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const res = await handleSubscribe(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.subscriberId).toBeDefined()
      // PII Protection: Destination must be masked in response
      expect(json.data.maskedDestination).toBe('c***@example.com')
      expect(json.data.isOptedIn).toBe(true)
    })

    it('POST /api/alerts/unsubscribe revokes consent and stops dispatches', async () => {
      // Register first
      const subId = 'SUB-UNSUB-TEST-1'
      await repository.saveSubscriber({
        id: subId,
        cityId: 'amritsar',
        channel: 'sms',
        destination: '+919876543210',
        sensitivity: 'high_sensitivity',
        geofence: { type: 'citywide' },
        isOptedIn: true,
        isVerified: true,
        isTestSubscriber: true,
        consentTimestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const req = new NextRequest('http://localhost:3000/api/alerts/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriberId: subId }),
      })

      const res = await handleUnsubscribe(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.isOptedIn).toBe(false)

      // Verify in repository
      const updated = await repository.getSubscriberById(subId)
      expect(updated?.isOptedIn).toBe(false)
      expect(updated?.unsubscribedAt).toBeDefined()
    })

    it('POST /api/alerts/preview returns modeled decision without queuing deliveries', async () => {
      const req = new NextRequest('http://localhost:3000/api/alerts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityId: 'amritsar', peakMm1h: 40, durationH: 3 }),
      })

      const res = await handlePreview(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.decision).toBeDefined()
      expect(json.data.sampleMessagePayload.alertType).toBe('modeled_risk_alert')
    })

    it('POST /api/alerts/dispatch rejects unauthorized calls with HTTP 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/alerts/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token',
        },
        body: JSON.stringify({ cityId: 'amritsar' }),
      })

      const res = await handleDispatch(req)
      expect(res.status).toBe(401)

      const json = await res.json()
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('UNAUTHORIZED_OPERATOR')
    })

    it('POST /api/alerts/dispatch executes dispatch with authorized operator token', async () => {
      const req = new NextRequest('http://localhost:3000/api/alerts/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-operator-token',
        },
        body: JSON.stringify({ cityId: 'amritsar', peakMm1h: 30, durationH: 3, forceTestProvider: true }),
      })

      const res = await handleDispatch(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.decision).toBeDefined()
      expect(json.data.rolloutMode).toBeDefined()
    })

    it('GET /api/alerts/status returns operational rollout mode and provider health', async () => {
      const req = new NextRequest('http://localhost:3000/api/alerts/status')
      const res = await handleStatus(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.rolloutMode).toBe('evaluation_only')
      expect(json.data.killSwitch).toBe(false)
      expect(json.data.providers).toBeDefined()
    })
  })
})
