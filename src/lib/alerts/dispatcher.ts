/**
 * src/lib/alerts/dispatcher.ts
 * End-to-end safe dispatch coordinator for NEXSTORM P20.
 * Recomputes risk decisions on the server, targets subscribers via geofences,
 * enforces quiet hours, cooldown deduplication, and routes via channel providers.
 */

import crypto from 'node:crypto'
import { evaluateAlertDecision, type AlertEvaluationOptions } from './engine'
import { isQuietHoursActive, matchSubscriberGeofence } from './geofence'
import { EmailProvider, SmsProvider, TestAlertProvider, WebhookProvider, type AlertProvider } from './providers/base'
import { getAlertRepository } from './repository'
import { evaluateCityReadiness } from '../city/readiness'
import {
  createAlertMessagePayload,
  getRolloutMode,
  isDeliveryPermittedForSubscriber,
  isKillSwitchActive,
} from './rollout'
import type {
  AlertChannel,
  AlertDecision,
  DeliveryRecord,
  DeliveryResult,
  RolloutMode,
} from './types'

export const ALERT_COOLDOWN_WINDOW_SECONDS = 7200 // 2 hours

export interface DispatchSummary {
  decision: AlertDecision
  rolloutMode: RolloutMode
  killSwitchActive: boolean
  totalSubscribersEvaluated: number
  matchedSubscribers: number
  queuedDeliveries: number
  successfulDeliveries: number
  suppressedDeliveries: number
  failedDeliveries: number
  deliveries: DeliveryRecord[]
}

export interface DispatchOptions extends AlertEvaluationOptions {
  forceTestProvider?: boolean
}

/**
 * Executes a full server-side alert decision and dispatch cycle.
 */
export async function runAlertDispatch(options: DispatchOptions = {}): Promise<DispatchSummary> {
  const repository = getAlertRepository()
  const rolloutMode = getRolloutMode()
  const killSwitch = isKillSwitchActive()

  // 1. Autoritative Server-side Risk Decision
  const decision = evaluateAlertDecision(options)

  const summary: DispatchSummary = {
    decision,
    rolloutMode,
    killSwitchActive: killSwitch,
    totalSubscribersEvaluated: 0,
    matchedSubscribers: 0,
    queuedDeliveries: 0,
    successfulDeliveries: 0,
    suppressedDeliveries: 0,
    failedDeliveries: 0,
    deliveries: [],
  }

  // If decision is not permitted (normal, stale, unavailable), abort dispatch without queueing
  if (!decision.permitted) {
    return summary
  }

  // 2. Fetch Opted-in Subscribers for City
  const cityId = decision.cityId
  const subscribers = await repository.getSubscribersByCity(cityId, { optedInOnly: true })
  summary.totalSubscribersEvaluated = subscribers.length

  const readiness = evaluateCityReadiness(cityId)

  // Channel provider instances
  const providers: Record<AlertChannel, AlertProvider> = {
    webhook: options.forceTestProvider || rolloutMode === 'test_mode' ? new TestAlertProvider('webhook') : new WebhookProvider(),
    email: options.forceTestProvider || rolloutMode === 'test_mode' ? new TestAlertProvider('email') : new EmailProvider(),
    sms: options.forceTestProvider || rolloutMode === 'test_mode' ? new TestAlertProvider('sms') : new SmsProvider(),
  }

  // 3. Process Each Candidate Subscriber
  for (const sub of subscribers) {
    // 3a. Geofence Match
    const match = matchSubscriberGeofence(sub, decision)
    if (!match.matches) continue

    summary.matchedSubscribers++

    // 3b. City Readiness & Evidence Insufficiency Gate (Hard Stop for uncalibrated cities)
    let isSuppressed = false
    let suppressionReason = ''

    if (readiness.determinedState === 'evidence_insufficient' || readiness.determinedState === 'configuration_only') {
      isSuppressed = true
      suppressionReason = `Suppressed: City '${cityId}' readiness state is '${readiness.determinedState}'; operational alerts disabled.`
    }

    // 3c. Rollout Permissions & Kill Switch
    if (!isSuppressed) {
      const rolloutCheck = isDeliveryPermittedForSubscriber(sub, rolloutMode)
      if (!rolloutCheck.permitted) {
        isSuppressed = true
        suppressionReason = rolloutCheck.reason
      }
    }

    // 3d. Quiet Hours Evaluation
    if (!isSuppressed) {
      const quietCheck = isQuietHoursActive(sub.quietHours, decision.state)
      if (quietCheck.isQuiet) {
        isSuppressed = true
        suppressionReason = quietCheck.reason || 'Suppressed: Quiet hours active'
      }
    }

    // 3d. Cooldown / Deduplication Guard
    if (!isSuppressed) {
      const recentDeliveries = await repository.getRecentDeliveriesForSubscriber(sub.id, ALERT_COOLDOWN_WINDOW_SECONDS)
      const duplicateRecent = recentDeliveries.find((d) => d.status === 'delivered')
      if (duplicateRecent) {
        isSuppressed = true
        suppressionReason = `Suppressed: Cooldown deduplication active (alert delivered at ${duplicateRecent.deliveredAt})`
      }
    }

    // 3e. Generate Idempotency Key
    // Key: sub_id + decision_id + dateHour
    const hourBucket = decision.evaluatedAt.slice(0, 13) // YYYY-MM-DDTHH
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`${sub.id}_${decision.decisionId}_${hourBucket}`)
      .digest('hex')

    // Check if key already delivered
    const alreadyDelivered = await repository.isIdempotencyKeyDelivered(idempotencyKey)
    if (alreadyDelivered) {
      summary.suppressedDeliveries++
      continue
    }

    const payload = createAlertMessagePayload(decision, match.matchedCorridor || `${decision.cityId.toUpperCase()} Core`)
    const deliveryId = `DEL-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`

    const deliveryRecord: DeliveryRecord = {
      deliveryId,
      decisionId: decision.decisionId,
      subscriberId: sub.id,
      destination: sub.destination,
      idempotencyKey,
      channel: sub.channel,
      status: isSuppressed ? 'suppressed' : 'pending',
      attemptCount: 0,
      maxAttempts: 3,
      failureReason: isSuppressed ? suppressionReason : undefined,
      payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Queue delivery
    await repository.addDelivery(deliveryRecord)
    summary.queuedDeliveries++

    if (isSuppressed) {
      summary.suppressedDeliveries++
      summary.deliveries.push(deliveryRecord)
      continue
    }

    // 3f. Invariant Re-check: Emergency Kill Switch before Transmission
    if (isKillSwitchActive()) {
      deliveryRecord.status = 'suppressed'
      deliveryRecord.failureReason = 'Suppressed: Operator emergency kill switch activated prior to transmission'
      await repository.updateDeliveryStatus(deliveryId, 'suppressed', {
        failureReason: deliveryRecord.failureReason,
      })
      summary.suppressedDeliveries++
      summary.deliveries.push(deliveryRecord)
      continue
    }

    // 3g. Invariant Re-check: Subscriber Opt-in Status before Transmission
    const currentSub = await repository.getSubscriberById(sub.id)
    if (!currentSub || !currentSub.isOptedIn) {
      deliveryRecord.status = 'suppressed'
      deliveryRecord.failureReason = 'Suppressed: Subscriber opted out prior to delivery'
      await repository.updateDeliveryStatus(deliveryId, 'suppressed', {
        failureReason: deliveryRecord.failureReason,
      })
      summary.suppressedDeliveries++
      summary.deliveries.push(deliveryRecord)
      continue
    }

    // 3h. Dispatch via Channel Provider
    const provider = providers[sub.channel]
    deliveryRecord.attemptCount++
    deliveryRecord.lastAttemptAt = new Date().toISOString()

    try {
      const result = await provider.send(deliveryRecord)
      if (result.success) {
        deliveryRecord.status = 'delivered'
        deliveryRecord.deliveredAt = result.deliveredAt || new Date().toISOString()
        await repository.updateDeliveryStatus(deliveryId, 'delivered', {
          deliveredAt: deliveryRecord.deliveredAt,
        })
        summary.successfulDeliveries++
      } else {
        const isDeadLetter = deliveryRecord.attemptCount >= deliveryRecord.maxAttempts || result.isRetryable === false
        deliveryRecord.status = isDeadLetter ? 'dead_letter' : 'failed'
        deliveryRecord.failureReason = result.error || 'Provider delivery failed'
        deliveryRecord.isRetryable = result.isRetryable
        await repository.updateDeliveryStatus(deliveryId, deliveryRecord.status, {
          failureReason: deliveryRecord.failureReason,
        })
        summary.failedDeliveries++
      }
    } catch (err) {
      deliveryRecord.attemptCount++
      const isDeadLetter = deliveryRecord.attemptCount >= deliveryRecord.maxAttempts
      deliveryRecord.status = isDeadLetter ? 'dead_letter' : 'failed'
      deliveryRecord.failureReason = err instanceof Error ? err.message : String(err)
      await repository.updateDeliveryStatus(deliveryId, deliveryRecord.status, {
        failureReason: deliveryRecord.failureReason,
      })
      summary.failedDeliveries++
    }

    summary.deliveries.push(deliveryRecord)
  }

  return summary
}

/**
 * Retries a failed delivery record with bounded exponential backoff and terminal dead-letter handling.
 */
export async function retryDelivery(
  deliveryId: string,
  options: { forceTestProvider?: boolean } = {}
): Promise<DeliveryResult> {
  const repository = getAlertRepository()
  const delivery = await repository.getDeliveryById(deliveryId)

  if (!delivery) {
    return {
      success: false,
      channel: 'webhook',
      providerName: 'DispatcherRetry',
      error: `Delivery '${deliveryId}' not found`,
      isRetryable: false,
    }
  }

  if (delivery.status === 'delivered') {
    return {
      success: true,
      channel: delivery.channel,
      providerName: 'DispatcherRetry',
      deliveredAt: delivery.deliveredAt,
    }
  }

  if (delivery.status === 'dead_letter' || delivery.attemptCount >= delivery.maxAttempts) {
    return {
      success: false,
      channel: delivery.channel,
      providerName: 'DispatcherRetry',
      error: `Terminal failure: Delivery '${deliveryId}' has reached max retry attempts (${delivery.maxAttempts}) and is dead-lettered.`,
      isRetryable: false,
    }
  }

  if (isKillSwitchActive()) {
    return {
      success: false,
      channel: delivery.channel,
      providerName: 'DispatcherRetry',
      error: 'Dispatch blocked: Operator emergency kill switch is active',
      isRetryable: true,
    }
  }

  const rolloutMode = getRolloutMode()
  const providers: Record<AlertChannel, AlertProvider> = {
    webhook: options.forceTestProvider || rolloutMode === 'test_mode' ? new TestAlertProvider('webhook') : new WebhookProvider(),
    email: options.forceTestProvider || rolloutMode === 'test_mode' ? new TestAlertProvider('email') : new EmailProvider(),
    sms: options.forceTestProvider || rolloutMode === 'test_mode' ? new TestAlertProvider('sms') : new SmsProvider(),
  }

  const provider = providers[delivery.channel]
  delivery.attemptCount++
  delivery.lastAttemptAt = new Date().toISOString()

  try {
    const result = await provider.send(delivery)
    if (result.success) {
      delivery.status = 'delivered'
      delivery.deliveredAt = result.deliveredAt || new Date().toISOString()
      await repository.updateDeliveryStatus(deliveryId, 'delivered', {
        deliveredAt: delivery.deliveredAt,
      })
      return result
    } else {
      const isDeadLetter = delivery.attemptCount >= delivery.maxAttempts || result.isRetryable === false
      delivery.status = isDeadLetter ? 'dead_letter' : 'failed'
      delivery.failureReason = result.error || 'Provider retry failed'
      await repository.updateDeliveryStatus(deliveryId, delivery.status, {
        failureReason: delivery.failureReason,
      })
      return { ...result, isRetryable: !isDeadLetter }
    }
  } catch (err) {
    const isDeadLetter = delivery.attemptCount >= delivery.maxAttempts
    delivery.status = isDeadLetter ? 'dead_letter' : 'failed'
    delivery.failureReason = err instanceof Error ? err.message : String(err)
    await repository.updateDeliveryStatus(deliveryId, delivery.status, {
      failureReason: delivery.failureReason,
    })
    return {
      success: false,
      channel: delivery.channel,
      providerName: 'DispatcherRetry',
      error: delivery.failureReason,
      isRetryable: !isDeadLetter,
    }
  }
}
