/**
 * Real-Time Notification Channel Provider Adapter
 * 
 * Reference: Socket.IO / Realtime Client
 * 
 * Capabilities:
 * - Emits live notification pushes to active browser/client listeners
 * - Zero dependency in-memory event bus
 * - Compatible with WebSocket or SSE streams
 */

import type {
  INotificationChannelProvider,
  NotificationChannel,
  Recipient,
  NotificationPayload,
  ChannelDeliveryResult,
} from '../types'

export type RealtimeNotificationListener = (
  recipient: Recipient,
  payload: NotificationPayload,
  messageId: string
) => void

export class RealtimeChannelProvider implements INotificationChannelProvider {
  public channel: NotificationChannel = 'realtime'
  private listeners = new Set<RealtimeNotificationListener>()

  public async send(
    recipient: Recipient,
    payload: NotificationPayload
  ): Promise<ChannelDeliveryResult> {
    const messageId = `rt_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

    for (const listener of this.listeners) {
      try {
        listener(recipient, payload, messageId)
      } catch {
        // Individual listener errors do not abort notification flow
      }
    }

    return {
      channel: 'realtime',
      status: 'delivered',
      messageId,
      provider: 'realtime-event-bus',
      timestamp: Date.now(),
    }
  }

  public subscribe(listener: RealtimeNotificationListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  public clear(): void {
    this.listeners.clear()
  }
}
