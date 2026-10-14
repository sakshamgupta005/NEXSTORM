/**
 * Resend Transactional Email Provider Adapter
 * 
 * Reference: Resend Node.js SDK (https://github.com/resend/resend-node)
 * 
 * Capabilities:
 * - Uses native fetch without heavy external SDK dependencies
 * - Auto-generates plain-text fallback from HTML if not provided
 * - Safe fallback to offline mock delivery when RESEND_API_KEY is not configured
 * - Email address validation
 */

import type {
  INotificationChannelProvider,
  NotificationChannel,
  Recipient,
  NotificationPayload,
  SendNotificationOptions,
  ChannelDeliveryResult,
} from '../types'
import { htmlToPlainText } from '../templates'

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export class ResendEmailProvider implements INotificationChannelProvider {
  public channel: NotificationChannel = 'email'
  private apiKey?: string
  private defaultSender: string

  constructor(apiKey?: string, defaultSender?: string) {
    this.apiKey = apiKey ?? process.env.RESEND_API_KEY
    this.defaultSender =
      defaultSender ??
      process.env.EMAIL_FROM ??
      'Hackathon Starter <onboarding@resend.dev>'
  }

  public async send(
    recipient: Recipient,
    payload: NotificationPayload,
    options?: SendNotificationOptions
  ): Promise<ChannelDeliveryResult> {
    if (!recipient.email || !isValidEmail(recipient.email)) {
      return {
        channel: 'email',
        status: 'failed',
        error: `Invalid recipient email address: '${recipient.email || ''}'`,
        provider: 'resend',
        timestamp: Date.now(),
      }
    }

    const fromAddress = options?.sender || payload.sender || this.defaultSender
    const plainText = payload.body || (payload.html ? htmlToPlainText(payload.html) : '')

    // If unconfigured, gracefully simulate successful delivery in development/testing
    if (!this.apiKey) {
      return {
        channel: 'email',
        status: 'delivered',
        messageId: `sim_email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        provider: 'resend-mock-fallback',
        timestamp: Date.now(),
      }
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [recipient.email.trim()],
          subject: payload.title,
          html: payload.html,
          text: plainText,
        }),
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as Record<string, unknown>
        const errorMsg =
          typeof errorData.message === 'string'
            ? errorData.message
            : `Resend HTTP error ${response.status}`

        return {
          channel: 'email',
          status: 'failed',
          error: errorMsg,
          provider: 'resend',
          timestamp: Date.now(),
        }
      }

      const resData = (await response.json()) as { id?: string }
      return {
        channel: 'email',
        status: 'delivered',
        messageId: resData.id || `resend_${Date.now()}`,
        provider: 'resend',
        timestamp: Date.now(),
      }
    } catch (err: unknown) {
      return {
        channel: 'email',
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        provider: 'resend',
        timestamp: Date.now(),
      }
    }
  }
}
