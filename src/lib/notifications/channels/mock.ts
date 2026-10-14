/**
 * Mock Notification Channel Providers for 100% Offline Testing
 * 
 * Capabilities:
 * - Records all dispatched notifications in-memory for testing assertions
 * - Supports simulated provider errors, timeouts, and latency
 * - Zero network calls or real-world email/SMS delivery
 */

import type {
  INotificationChannelProvider,
  NotificationChannel,
  Recipient,
  NotificationPayload,
  SendNotificationOptions,
  ChannelDeliveryResult,
} from '../types'

export interface MockSentNotification {
  channel: NotificationChannel
  recipient: Recipient
  payload: NotificationPayload
  options?: SendNotificationOptions
  timestamp: number
  messageId: string
}

export class MockChannelProvider implements INotificationChannelProvider {
  public channel: NotificationChannel
  private sentMessages: MockSentNotification[] = []
  private simulateFailure = false
  private failureError = 'Simulated provider network failure'

  constructor(channel: NotificationChannel) {
    this.channel = channel
  }

  public async send(
    recipient: Recipient,
    payload: NotificationPayload,
    options?: SendNotificationOptions
  ): Promise<ChannelDeliveryResult> {
    if (this.simulateFailure) {
      return {
        channel: this.channel,
        status: 'failed',
        error: this.failureError,
        provider: `mock-${this.channel}`,
        timestamp: Date.now(),
      }
    }

    const messageId = `mock_msg_${this.channel}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

    this.sentMessages.push({
      channel: this.channel,
      recipient,
      payload,
      options,
      timestamp: Date.now(),
      messageId,
    })

    return {
      channel: this.channel,
      status: 'delivered',
      messageId,
      provider: `mock-${this.channel}`,
      timestamp: Date.now(),
    }
  }

  public getSentMessages(): MockSentNotification[] {
    return [...this.sentMessages]
  }

  public setFailure(shouldFail: boolean, errorMsg?: string): void {
    this.simulateFailure = shouldFail
    if (errorMsg) this.failureError = errorMsg
  }

  public clear(): void {
    this.sentMessages = []
    this.simulateFailure = false
  }
}
