/**
 * Persistent In-App Channel Provider Adapter
 */

import type {
  INotificationChannelProvider,
  NotificationChannel,
  Recipient,
  NotificationPayload,
  ChannelDeliveryResult,
  IInAppStore,
} from '../types'
import { sharedInAppStore } from '../in-app'

export class InAppChannelProvider implements INotificationChannelProvider {
  public channel: NotificationChannel = 'in_app'
  private store: IInAppStore

  constructor(store: IInAppStore = sharedInAppStore) {
    this.store = store
  }

  public async send(
    recipient: Recipient,
    payload: NotificationPayload
  ): Promise<ChannelDeliveryResult> {
    if (!recipient.id) {
      return {
        channel: 'in_app',
        status: 'failed',
        error: 'Recipient is missing required user ID for in-app delivery',
        provider: 'in-app-store',
        timestamp: Date.now(),
      }
    }

    const notificationId = `inapp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

    await this.store.create({
      id: notificationId,
      userId: recipient.id,
      title: payload.title,
      body: payload.body,
      category: payload.category || 'transactional',
      read: false,
      actionUrl: payload.actionUrl,
      data: payload.data,
      createdAt: Date.now(),
    })

    return {
      channel: 'in_app',
      status: 'delivered',
      messageId: notificationId,
      provider: 'in-app-store',
      timestamp: Date.now(),
    }
  }
}
