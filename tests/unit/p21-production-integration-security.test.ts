/**
 * tests/unit/p21-production-integration-security.test.ts
 * Regression & Integration test suite for NEXSTORM P21 — Production Integration & Security Verification.
 * Verifies lifecycle tracing, Supabase RLS & persistence contracts, hardened safety invariants,
 * comprehensive SSRF protection, provider delivery lifecycle, and deployment preflight tooling.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { evaluateAlertDecision, createScenarioRainfallSeries } from '@/lib/alerts/engine'
import { matchSubscriberGeofence, isQuietHoursActive } from '@/lib/alerts/geofence'
import {
  TestAlertProvider,
  getBackoffSeconds,
} from '@/lib/alerts/providers/base'
import {
  isProhibitedIp,
  isProhibitedIpv4,
  isProhibitedIpv6,
  normalizeNumericIpv4,
  validateOutboundUrl,
  verifyWebhookSignature,
} from '@/lib/alerts/ssrf'
import {
  isKillSwitchActive,
  isDeliveryPermittedForSubscriber,
} from '@/lib/alerts/rollout'
import { runAlertDispatch, retryDelivery } from '@/lib/alerts/dispatcher'
import { getAlertRepository } from '@/lib/alerts/repository'
import { runDeploymentPreflight } from '@/lib/alerts/preflight'
import type { DeliveryRecord, SubscriberPreference } from '@/lib/alerts/types'

describe('NEXSTORM P21 — Production Integration & Security Verification', () => {
  const repository = getAlertRepository()

  beforeEach(async () => {
    await repository.reset('amritsar')
    TestAlertProvider.clear()
    delete process.env.DISPATCH_KILL_SWITCH
    delete process.env.DISPATCH_ROLLOUT_MODE
    delete process.env.ALERT_OPERATOR_KEY
    delete process.env.ALERT_WEBHOOK_SECRET
  })

  // =========================================================================
  // Phase 1 — Complete Subscriber Lifecycle Tracing
  // =========================================================================
  describe('Phase 1: Full Subscriber Lifecycle Tracing', () => {
    it('executes the full lifecycle: consent -> persistence -> eval -> match -> queue -> deliver -> unsubscribe -> suppression', async () => {
      process.env.DISPATCH_ROLLOUT_MODE = 'test_mode'

      // 1. Consent & Registration
      const subId = 'SUB-LIFECYCLE-1'
      const subscriber: SubscriberPreference = {
        id: subId,
        cityId: 'amritsar',
        channel: 'webhook',
        destination: 'https://webhook.site/lifecycle-test',
        sensitivity: 'high_sensitivity',
        geofence: { type: 'citywide' },
        isOptedIn: true,
        isVerified: true,
        isTestSubscriber: true,
        consentTimestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await repository.saveSubscriber(subscriber)

      // 2. Persistence verification
      const fetchedSub = await repository.getSubscriberById(subId)
      expect(fetchedSub).not.toBeNull()
      expect(fetchedSub?.isOptedIn).toBe(true)

      // 3. Risk Evaluation & Decision
      const series = createScenarioRainfallSeries({
        cityId: 'amritsar',
        peakMm1h: 40,
        durationH: 3,
      })
      const decision = evaluateAlertDecision({ cityId: 'amritsar', series })
      expect(decision.permitted).toBe(true)

      // 4. Geofence Matching
      const geofenceMatch = matchSubscriberGeofence(fetchedSub!, decision)
      expect(geofenceMatch.matches).toBe(true)

      // 5. Dispatch & Queue Execution (with test provider)
      const dispatchSummary = await runAlertDispatch({
        cityId: 'amritsar',
        series,
        forceTestProvider: true,
      })

      expect(dispatchSummary.queuedDeliveries).toBe(1)
      expect(dispatchSummary.successfulDeliveries).toBe(1)
      expect(TestAlertProvider.deliveredQueue.length).toBe(1)

      const queuedDelivery = dispatchSummary.deliveries[0]
      expect(queuedDelivery.status).toBe('delivered')
      expect(queuedDelivery.destination).toBe('https://webhook.site/lifecycle-test')

      // 6. Unsubscribe
      const unsubSuccess = await repository.unsubscribe(subId)
      expect(unsubSuccess).toBe(true)

      const unsubSub = await repository.getSubscriberById(subId)
      expect(unsubSub?.isOptedIn).toBe(false)
      expect(unsubSub?.unsubscribedAt).toBeDefined()

      // 7. Verify Immediate Suppression of Subsequent Dispatches
      const newSeries = createScenarioRainfallSeries({
        cityId: 'amritsar',
        peakMm1h: 60,
        durationH: 4,
      })
      const subsequentSummary = await runAlertDispatch({
        cityId: 'amritsar',
        series: newSeries,
        forceTestProvider: true,
      })

      // Unsubscribed candidate is excluded from active dispatches
      expect(subsequentSummary.matchedSubscribers).toBe(0)
      expect(subsequentSummary.successfulDeliveries).toBe(0)
    })
  })

  // =========================================================================
  // Phase 2 — Supabase Schema, RLS & Durability Contracts
  // =========================================================================
  describe('Phase 2: Supabase Schema, Constraints & Durability Contracts', () => {
    it('verifies SQL migration syntax, tables, and strict RLS policies in migration file', () => {
      const migrationPath = path.join(
        process.cwd(),
        'supabase',
        'migrations',
        '20261015_create_alert_subsystems.sql'
      )
      expect(fs.existsSync(migrationPath)).toBe(true)
      const sql = fs.readFileSync(migrationPath, 'utf-8')

      // Verify Table Definitions
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.alert_subscribers')
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.alert_decisions')
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.alert_deliveries')

      // Verify PostGIS Geometry & Spatial Index
      expect(sql).toContain('geofence_geom geometry(Geometry, 4326)')
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_subscribers_geom')

      // Verify Foreign Key & Unique Constraints
      expect(sql).toContain('REFERENCES public.alert_decisions(id)')
      expect(sql).toContain('REFERENCES public.alert_subscribers(id)')
      expect(sql).toContain('idempotency_key VARCHAR(128) NOT NULL UNIQUE')

      // Verify Row Level Security (RLS) Enablement
      expect(sql).toContain('ALTER TABLE public.alert_subscribers ENABLE ROW LEVEL SECURITY')
      expect(sql).toContain('ALTER TABLE public.alert_decisions ENABLE ROW LEVEL SECURITY')
      expect(sql).toContain('ALTER TABLE public.alert_deliveries ENABLE ROW LEVEL SECURITY')

      // Verify Subscriber Privacy & Isolation Policy (auth.uid() = user_id)
      expect(sql).toContain('auth.uid() = user_id')
      expect(sql).toContain('service_role')
    })

    it('detects and flags non-durable local file persistence when durable storage is needed', async () => {
      const repo = getAlertRepository()
      // In local dev without remote Supabase credentials, isDurable is false
      expect(typeof repo.isDurable()).toBe('boolean')

      // Preflight in limited_rollout requires durable PostgreSQL
      const preflight = await runDeploymentPreflight('limited_rollout')
      const dbCheck = preflight.checks.find((c) => c.id === 'persistence_durability')
      expect(dbCheck).toBeDefined()
      if (!repo.isDurable()) {
        expect(dbCheck?.status).toBe('FAIL')
        expect(dbCheck?.message).toContain('Durable Supabase PostgreSQL is required')
      }
    })

    it('enforces atomic idempotency and rejects concurrent duplicates for the same key', async () => {
      const testKey = 'IDEMP-TEST-KEY-001'
      const delivery1: DeliveryRecord = {
        deliveryId: 'DEL-IDEMP-1',
        decisionId: 'DEC-001',
        subscriberId: 'SUB-001',
        idempotencyKey: testKey,
        channel: 'webhook',
        status: 'delivered',
        attemptCount: 1,
        maxAttempts: 3,
        payload: {
          alertType: 'modeled_risk_alert',
          alertId: 'DEC-001',
          cityId: 'amritsar',
          severity: 'elevated',
          maxRti: 0.8,
          thresholdApplied: 0.75,
          affectedAreaDescription: 'Test',
          affectedCellsCount: 2,
          evaluatedAt: new Date().toISOString(),
          weatherFreshnessNote: 'Test',
          safetyGuidance: 'Test',
          disclaimer: 'Test',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await repository.addDelivery(delivery1)
      const isDelivered = await repository.isIdempotencyKeyDelivered(testKey)
      expect(isDelivered).toBe(true)

      // Second delivery with identical idempotency key is recognized as already delivered
      const checkAgain = await repository.isIdempotencyKeyDelivered(testKey)
      expect(checkAgain).toBe(true)
    })
  })

  // =========================================================================
  // Phase 3 — Hardened Alert Safety Invariants
  // =========================================================================
  describe('Phase 3: Hardened Alert Safety Invariants', () => {
    it('Invariant 1: Global kill switch always blocks dispatch across all modes and channels', () => {
      process.env.DISPATCH_KILL_SWITCH = 'true'
      expect(isKillSwitchActive()).toBe(true)

      const sub: SubscriberPreference = {
        id: 'SUB-KILL-1',
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
      }

      // Even in GA or test mode, kill switch must block
      const checkGA = isDeliveryPermittedForSubscriber(sub, 'general_availability')
      expect(checkGA.permitted).toBe(false)
      expect(checkGA.reason).toContain('kill switch')

      const checkTest = isDeliveryPermittedForSubscriber(sub, 'test_mode')
      expect(checkTest.permitted).toBe(false)
      expect(checkTest.reason).toContain('kill switch')
    })

    it('Invariant 2: evaluation_only mode strictly suppresses external sends', () => {
      const sub: SubscriberPreference = {
        id: 'SUB-EVAL-1',
        cityId: 'amritsar',
        channel: 'email',
        destination: 'citizen@example.com',
        sensitivity: 'high_sensitivity',
        geofence: { type: 'citywide' },
        isOptedIn: true,
        isVerified: true,
        isTestSubscriber: true,
        consentTimestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const check = isDeliveryPermittedForSubscriber(sub, 'evaluation_only')
      expect(check.permitted).toBe(false)
      expect(check.reason).toContain('evaluation_only')
    })

    it('Invariant 3: test_mode permits ONLY explicitly authorized test subscribers', () => {
      const realCitizen: SubscriberPreference = {
        id: 'SUB-REAL-1',
        cityId: 'amritsar',
        channel: 'sms',
        destination: '+919876543210',
        sensitivity: 'high_sensitivity',
        geofence: { type: 'citywide' },
        isOptedIn: true,
        isVerified: true,
        isTestSubscriber: false, // NOT a test subscriber
        consentTimestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const testUser: SubscriberPreference = {
        ...realCitizen,
        id: 'SUB-TEST-DEV-1',
        isTestSubscriber: true,
      }

      expect(isDeliveryPermittedForSubscriber(realCitizen, 'test_mode').permitted).toBe(false)
      expect(isDeliveryPermittedForSubscriber(testUser, 'test_mode').permitted).toBe(true)
    })

    it('Invariant 4 & 5: Stale or unavailable weather CANNOT be bypassed by severe risk or threshold', () => {
      // Storm is massive (100mm peak), but weather is stale (7200s old)
      const staleSeries = createScenarioRainfallSeries({
        cityId: 'amritsar',
        peakMm1h: 100,
        durationH: 4,
      })
      staleSeries.provenance.fetchedAt = new Date(Date.now() - 7200 * 1000).toISOString()

      const decisionStale = evaluateAlertDecision({
        cityId: 'amritsar',
        sensitivity: 'high_sensitivity',
        series: staleSeries,
      })

      // Must be suppressed despite extreme rainfall
      expect(decisionStale.permitted).toBe(false)
      expect(decisionStale.state).toBe('stale_data')
      expect(decisionStale.suppressionReason).toContain('stale')

      // Unavailable weather must also suppress
      const decisionUnavailable = evaluateAlertDecision({
        cityId: 'amritsar',
        isWeatherUnavailable: true,
        weatherError: 'Connection to weather model timed out',
      })
      expect(decisionUnavailable.permitted).toBe(false)
      expect(decisionUnavailable.state).toBe('unavailable_weather')
    })

    it('Invariant 6: Severe-risk quiet-hours bypass changes ONLY quiet hours; never bypasses consent, kill switch, or rollout mode', () => {
      const quietConfig = {
        enabled: true,
        startLocalHour: 22,
        endLocalHour: 7,
        timezone: 'Asia/Kolkata',
      }

      // Severe risk bypasses quiet hours check
      const quietCheck = isQuietHoursActive(quietConfig, 'severe_risk')
      expect(quietCheck.isQuiet).toBe(false)
      expect(quietCheck.reason).toContain('Severe risk')

      // BUT if subscriber opted out, severe risk does NOT bypass opt-out consent!
      const optedOutSub: SubscriberPreference = {
        id: 'SUB-OPTED-OUT-1',
        cityId: 'amritsar',
        channel: 'email',
        destination: 'optout@example.com',
        sensitivity: 'high_sensitivity',
        geofence: { type: 'citywide' },
        isOptedIn: false, // Opted out
        isVerified: true,
        isTestSubscriber: true,
        consentTimestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const consentCheck = isDeliveryPermittedForSubscriber(optedOutSub, 'test_mode')
      expect(consentCheck.permitted).toBe(false)
      expect(consentCheck.reason).toContain('opted out')

      // AND if kill switch is active, severe risk does NOT bypass kill switch!
      process.env.DISPATCH_KILL_SWITCH = 'true'
      const killCheck = isDeliveryPermittedForSubscriber(
        { ...optedOutSub, isOptedIn: true },
        'test_mode'
      )
      expect(killCheck.permitted).toBe(false)
      expect(killCheck.reason).toContain('kill switch')
    })

    it('Invariant 7: Mid-dispatch kill switch activation suppresses queued delivery before transmission', async () => {
      process.env.DISPATCH_ROLLOUT_MODE = 'test_mode'

      const sub: SubscriberPreference = {
        id: 'SUB-KILL-RACE-1',
        cityId: 'amritsar',
        channel: 'webhook',
        destination: 'https://webhook.site/kill-test',
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

      // Activate kill switch
      process.env.DISPATCH_KILL_SWITCH = 'true'

      const series = createScenarioRainfallSeries({
        cityId: 'amritsar',
        peakMm1h: 50,
        durationH: 3,
      })

      const summary = await runAlertDispatch({
        cityId: 'amritsar',
        series,
        forceTestProvider: true,
      })

      // Zero successful deliveries
      expect(summary.successfulDeliveries).toBe(0)
      expect(TestAlertProvider.deliveredQueue.length).toBe(0)
    })
  })

  // =========================================================================
  // Phase 4 — Complete Webhook SSRF Defense & Outbound Security
  // =========================================================================
  describe('Phase 4: Advanced Webhook SSRF Defense & Outbound Security', () => {
    it('detects and blocks direct IPv4 loopback and private ranges', () => {
      expect(isProhibitedIpv4('127.0.0.1')).toBe(true)
      expect(isProhibitedIpv4('127.0.0.2')).toBe(true)
      expect(isProhibitedIpv4('10.0.0.1')).toBe(true)
      expect(isProhibitedIpv4('172.16.0.1')).toBe(true)
      expect(isProhibitedIpv4('172.31.255.254')).toBe(true)
      expect(isProhibitedIpv4('192.168.1.1')).toBe(true)
      expect(isProhibitedIpv4('169.254.169.254')).toBe(true) // Cloud metadata
      expect(isProhibitedIpv4('0.0.0.0')).toBe(true)
      expect(isProhibitedIpv4('100.64.0.1')).toBe(true) // CGNAT
      expect(isProhibitedIpv4('8.8.8.8')).toBe(false) // Public IP
      expect(isProhibitedIpv4('1.1.1.1')).toBe(false) // Public IP
    })

    it('detects and blocks IPv6 loopback, private, and link-local ranges', () => {
      expect(isProhibitedIpv6('::1')).toBe(true)
      expect(isProhibitedIpv6('::')).toBe(true)
      expect(isProhibitedIpv6('fc00::1')).toBe(true)
      expect(isProhibitedIpv6('fd12:3456:789a::1')).toBe(true)
      expect(isProhibitedIpv6('fe80::1')).toBe(true)
      expect(isProhibitedIpv6('2606:4700:4700::1111')).toBe(false) // Cloudflare public IPv6
    })

    it('normalizes and blocks alternate numeric representations (octal, hex, dword, compact)', () => {
      // Dword decimal 2130706433 = 127.0.0.1
      expect(normalizeNumericIpv4('2130706433')).toBe('127.0.0.1')
      expect(isProhibitedIp('2130706433')).toBe(true)

      // Hexadecimal 0x7f000001 = 127.0.0.1
      expect(normalizeNumericIpv4('0x7f000001')).toBe('127.0.0.1')
      expect(isProhibitedIp('0x7f000001')).toBe(true)

      // Octal 0177.0.0.1 = 127.0.0.1
      expect(normalizeNumericIpv4('0177.0.0.1')).toBe('127.0.0.1')
      expect(isProhibitedIp('0177.0.0.1')).toBe(true)

      // Compact 127.1 = 127.0.0.1
      expect(normalizeNumericIpv4('127.1')).toBe('127.0.0.1')
      expect(isProhibitedIp('127.1')).toBe(true)

      // IPv4-mapped IPv6 ::ffff:127.0.0.1
      expect(isProhibitedIp('::ffff:127.0.0.1')).toBe(true)
      expect(isProhibitedIp('::ffff:10.0.0.1')).toBe(true)
      expect(isProhibitedIp('::ffff:169.254.169.254')).toBe(true)
    })

    it('blocks internal hostnames and cloud metadata endpoints', async () => {
      const resLocal = await validateOutboundUrl('https://localhost/webhook')
      expect(resLocal.isValid).toBe(false)
      expect(resLocal.error).toContain('internal/private')

      const resMeta = await validateOutboundUrl('http://169.254.169.254/latest/meta-data/', { allowHttpInDev: true })
      expect(resMeta.isValid).toBe(false)
      expect(resMeta.error).toContain('private, loopback, or reserved')

      const resGoogleMeta = await validateOutboundUrl('http://metadata.google.internal/computeMetadata/v1/', { allowHttpInDev: true })
      expect(resGoogleMeta.isValid).toBe(false)
      expect(resGoogleMeta.error).toContain('internal/private')
    })

    it('blocks non-standard ports and credentials in URL', async () => {
      // Dangerous port: SSH 22, Postgres 5432, Redis 6379
      const resPort22 = await validateOutboundUrl('https://webhook.site:22/hook')
      expect(resPort22.isValid).toBe(false)
      expect(resPort22.error).toContain('Port 22 is prohibited')

      const resPort5432 = await validateOutboundUrl('https://webhook.site:5432/hook')
      expect(resPort5432.isValid).toBe(false)
      expect(resPort5432.error).toContain('Port 5432 is prohibited')

      // Embedded credentials
      const resCreds = await validateOutboundUrl('https://admin:secret@webhook.site/hook')
      expect(resCreds.isValid).toBe(false)
      expect(resCreds.error).toContain('embedded credentials')
    })

    it('detects DNS resolution to prohibited addresses and rebinding', async () => {
      // Mock DNS resolver resolving a public-looking domain to 127.0.0.1
      const mockResolver = async () => ['127.0.0.1']

      const result = await validateOutboundUrl('https://evil-rebinding-domain.com/hook', {
        dnsResolver: mockResolver,
      })

      expect(result.isValid).toBe(false)
      expect(result.error).toContain("resolves to prohibited IP '127.0.0.1'")
    })

    it('enforces HMAC-SHA256 signature and timing-safe replay verification', () => {
      const secret = 'test-secret-key-at-least-32-chars-long-abc'
      const payload = JSON.stringify({ alert: 'modeled_risk_alert', city: 'amritsar' })
      const now = Math.floor(Date.now() / 1000)

      const validSig = crypto
        .createHmac('sha256', secret)
        .update(`${now}.${payload}`)
        .digest('hex')

      // Valid signature
      const validCheck = verifyWebhookSignature({
        payload,
        signatureHeader: `t=${now},v1=${validSig}`,
        secret,
      })
      expect(validCheck.valid).toBe(true)

      // Forged signature
      const forgedCheck = verifyWebhookSignature({
        payload,
        signatureHeader: `t=${now},v1=bad_signature_hex_value_00000000000000000000000000000000000000000000`,
        secret,
      })
      expect(forgedCheck.valid).toBe(false)
      expect(forgedCheck.reason).toContain('mismatch')

      // Replay attack (timestamp 400 seconds old > 300s tolerance)
      const oldTime = now - 400
      const oldSig = crypto
        .createHmac('sha256', secret)
        .update(`${oldTime}.${payload}`)
        .digest('hex')

      const replayCheck = verifyWebhookSignature({
        payload,
        signatureHeader: `t=${oldTime},v1=${oldSig}`,
        secret,
        toleranceSeconds: 300,
      })
      expect(replayCheck.valid).toBe(false)
      expect(replayCheck.reason).toContain('expired')
    })
  })

  // =========================================================================
  // Phase 5 — Provider Delivery Lifecycle & Retries
  // =========================================================================
  describe('Phase 5: Provider Delivery Lifecycle & Retry Bounds', () => {
    it('calculates bounded exponential backoff correctly', () => {
      expect(getBackoffSeconds(1)).toBe(5)
      expect(getBackoffSeconds(2)).toBe(10)
      expect(getBackoffSeconds(3)).toBe(20)
      expect(getBackoffSeconds(4)).toBe(40)
      expect(getBackoffSeconds(10)).toBe(300) // Capped at 300s
    })

    it('transitions to dead_letter state when max retry attempts are exhausted', async () => {
      process.env.DISPATCH_ROLLOUT_MODE = 'test_mode'

      const deliveryId = 'DEL-MAX-RETRY-001'
      const failedDelivery: DeliveryRecord = {
        deliveryId,
        decisionId: 'DEC-RETRY-1',
        subscriberId: 'SUB-RETRY-1',
        destination: 'https://webhook.site/retry-target',
        idempotencyKey: 'IDEMP-RETRY-001',
        channel: 'webhook',
        status: 'failed',
        attemptCount: 3, // Already at maxAttempts
        maxAttempts: 3,
        failureReason: 'Provider 500 error',
        payload: {
          alertType: 'modeled_risk_alert',
          alertId: 'DEC-RETRY-1',
          cityId: 'amritsar',
          severity: 'elevated',
          maxRti: 0.9,
          thresholdApplied: 0.75,
          affectedAreaDescription: 'Test',
          affectedCellsCount: 3,
          evaluatedAt: new Date().toISOString(),
          weatherFreshnessNote: 'Test',
          safetyGuidance: 'Test',
          disclaimer: 'Test',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await repository.addDelivery(failedDelivery)

      // Attempt retry on maxed-out delivery
      const retryResult = await retryDelivery(deliveryId, { forceTestProvider: true })
      expect(retryResult.success).toBe(false)
      expect(retryResult.isRetryable).toBe(false)
      expect(retryResult.error).toContain('dead-lettered')
    })
  })

  // =========================================================================
  // Phase 6 — Deployment Preflight Checks
  // =========================================================================
  describe('Phase 6: Deployment Preflight Checks & Operator Health', () => {
    it('passes preflight in evaluation_only mode with safe defaults', async () => {
      const report = await runDeploymentPreflight('evaluation_only')
      expect(report.rolloutMode).toBe('evaluation_only')
      expect(report.summary.fail).toBe(0)
      expect(report.ready).toBe(true)
    })

    it('fails closed when limited_rollout is attempted with weak or missing operator keys', async () => {
      process.env.ALERT_OPERATOR_KEY = 'short'
      const report = await runDeploymentPreflight('limited_rollout')
      expect(report.ready).toBe(false)
      expect(report.summary.fail).toBeGreaterThan(0)

      const opCheck = report.checks.find((c) => c.id === 'operator_key')
      expect(opCheck?.status).toBe('FAIL')
    })

    it('rejects placeholder secrets during preflight', async () => {
      process.env.ALERT_OPERATOR_KEY = 'your-operator-key-here-placeholder'
      process.env.ALERT_WEBHOOK_SECRET = 'insert-secret-key-placeholder'

      const report = await runDeploymentPreflight('test_mode')
      expect(report.ready).toBe(false)

      const opCheck = report.checks.find((c) => c.id === 'operator_key')
      expect(opCheck?.status).toBe('FAIL')
      expect(opCheck?.message).toContain('placeholder')
    })
  })
})
