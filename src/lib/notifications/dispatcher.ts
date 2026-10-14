/**
 * Multi-Channel Notification Dispatcher & Coordinator
 * 
 * Capabilities:
 * - Multi-channel fanout (Email, In-App, Realtime, SMS)
 * - User preference & channel opt-out enforcement
 * - Template resolution with safe variable interpolation
 * - Idempotency deduplication to prevent duplicate message sends
 * - Asynchronous background queueing support via sharedJobQueue
 * - Detailed delivery status and error reporting
 */

import type {
  INotificationChannelProvider,
  NotificationChannel,
  Recipient,
  NotificationPayload,
  SendNotificationOptions,
  NotificationDeliveryResult,
  ChannelDeliveryResult,
  IPreferenceStore,
} from './types'
import { sharedTemplateRegistry, NotificationTemplateRegistry } from './templates'
import { sharedPreferenceStore } from './preferences'
import { ResendEmailProvider } from './channels/resend'
import { InAppChannelProvider } from './channels/in-app'
import { RealtimeChannelProvider } from './channels/realtime'
import { SmsChannelProvider } from './channels/sms'
import { sharedJobQueue } from '../jobs/queue'

export interface DispatcherOptions {
  preferenceStore?: IPreferenceStore
  templateRegistry?: NotificationTemplateRegistry
  idempotencyTtlMs?: number
}

export class NotificationDispatcher {
  private providers = new Map<NotificationChannel, INotificationChannelProvider>()
  private preferenceStore: IPreferenceStore
  private templateRegistry: NotificationTemplateRegistry
  private idempotencyCache = new Map<string, { result: NotificationDeliveryResult; expiresAt: number }>()
  private idempotencyTtlMs: number

  constructor(options: DispatcherOptions = {}) {
    this.preferenceStore = options.preferenceStore ?? sharedPreferenceStore
    this.templateRegistry = options.templateRegistry ?? sharedTemplateRegistry
    this.idempotencyTtlMs = options.idempotencyTtlMs ?? 3600_000 // 1 hour

    // Register standard default providers
    this.registerProvider(new ResendEmailProvider())
    this.registerProvider(new InAppChannelProvider())
    this.registerProvider(new RealtimeChannelProvider())
    this.registerProvider(new SmsChannelProvider())

    // Register async queue handler if job queue is active
    this.registerAsyncJobHandler()
  }

  public registerProvider(provider: INotificationChannelProvider): void {
    this.providers.set(provider.channel, provider)
  }

  public getProvider(channel: NotificationChannel): INotificationChannelProvider | undefined {
    return this.providers.get(channel)
  }

  public async send(
    recipient: Recipient,
    payload: NotificationPayload,
    options: SendNotificationOptions = {}
  ): Promise<NotificationDeliveryResult> {
    const now = Date.now()

    // 1. Idempotency Check
    if (options.idempotencyKey) {
      const cached = this.idempotencyCache.get(options.idempotencyKey)
      if (cached && cached.expiresAt > now) {
        return cached.result
      }
    }

    // 2. Asynchronous Queue Mode
    if (options.async) {
      const job = await sharedJobQueue.enqueue<{
        recipient: Recipient
        payload: NotificationPayload
        options: SendNotificationOptions
      }>(
        'send_notification',
        { recipient, payload, options: { ...options, async: false } },
        {
          idempotencyKey: options.idempotencyKey,
          isIdempotent: true,
          retryPolicy: { maxRetries: 2, backoffMs: 1000 },
        }
      )

      const queuedResult: NotificationDeliveryResult = {
        notificationId: job.id,
        success: true,
        results: (options.channels || ['in_app']).map((channel) => ({
          channel,
          status: 'queued',
          messageId: job.id,
          timestamp: now,
        })),
      }

      if (options.idempotencyKey) {
        this.idempotencyCache.set(options.idempotencyKey, {
          result: queuedResult,
          expiresAt: now + this.idempotencyTtlMs,
        })
      }

      return queuedResult
    }

    // 3. Resolve Template (if provided)
    const resolvedPayload = this.templateRegistry.applyToPayload(payload)

    // 4. Determine Target Channels
    const requestedChannels: NotificationChannel[] = options.channels?.length
      ? options.channels
      : ['in_app', 'email']

    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const deliveryResults: ChannelDeliveryResult[] = []
    const skippedChannels: NotificationChannel[] = []
    const errors: Record<string, string> = {}

    for (const channel of requestedChannels) {
      // 5. Check User Preference & Opt-Outs
      const isEnabled = await Promise.resolve(
        this.preferenceStore.isChannelEnabled(
          recipient.id,
          channel,
          resolvedPayload.category || 'transactional'
        )
      )

      if (!isEnabled) {
        skippedChannels.push(channel)
        deliveryResults.push({
          channel,
          status: 'skipped',
          error: `Channel '${channel}' is disabled by user preferences`,
          timestamp: Date.now(),
        })
        continue
      }

      // 6. Deliver to Channel Provider
      const provider = this.providers.get(channel)
      if (!provider) {
        errors[channel] = `No provider registered for channel '${channel}'`
        deliveryResults.push({
          channel,
          status: 'failed',
          error: errors[channel],
          timestamp: Date.now(),
        })
        continue
      }

      try {
        const result = await provider.send(recipient, resolvedPayload, options)
        deliveryResults.push(result)
        if (result.status === 'failed' && result.error) {
          errors[channel] = result.error
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        errors[channel] = errorMsg
        deliveryResults.push({
          channel,
          status: 'failed',
          error: errorMsg,
          provider: provider.channel,
          timestamp: Date.now(),
        })
      }
    }

    const hasAnySuccess = deliveryResults.some((r) => r.status === 'delivered')
    const finalResult: NotificationDeliveryResult = {
      notificationId,
      success: hasAnySuccess || (deliveryResults.length === 0 && skippedChannels.length > 0),
      results: deliveryResults,
      skippedChannels: skippedChannels.length > 0 ? skippedChannels : undefined,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    }

    if (options.idempotencyKey) {
      this.idempotencyCache.set(options.idempotencyKey, {
        result: finalResult,
        expiresAt: now + this.idempotencyTtlMs,
      })
    }

    return finalResult
  }

  private registerAsyncJobHandler(): void {
    sharedJobQueue.registerHandler<{
      recipient: Recipient
      payload: NotificationPayload
      options: SendNotificationOptions
    }>('send_notification', async (job) => {
      return this.send(job.data.recipient, job.data.payload, job.data.options)
    })
  }
}

export const sharedNotificationDispatcher = new NotificationDispatcher()
