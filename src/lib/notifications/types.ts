/**
 * Provider-Neutral Notifications & Messaging Toolkit — Types & Contracts
 * 
 * References Studied:
 * - Resend Node.js SDK (https://github.com/resend/resend-node) — Clean transactional email REST payload
 * - Nodemailer (https://github.com/nodemailer/nodemailer) — Transport abstractions, plain text fallback, sender identity
 * - Novu (https://github.com/novuhq/novu) — Multi-channel workflows, user preferences, template variables
 * - Socket.IO (https://github.com/socketio/socket.io) — Realtime in-app notification emission
 */

export type NotificationChannel = 'email' | 'in_app' | 'sms' | 'realtime'

export type NotificationCategory = 'transactional' | 'security' | 'marketing' | 'system'

export interface Recipient {
  id: string
  email?: string
  phone?: string
  name?: string
  metadata?: Record<string, unknown>
}

export interface NotificationPayload {
  title: string
  body: string
  html?: string
  templateId?: string
  variables?: Record<string, unknown>
  category?: NotificationCategory
  actionUrl?: string
  data?: Record<string, unknown>
  sender?: string
}

export interface SendNotificationOptions {
  channels?: NotificationChannel[]
  priority?: 'high' | 'normal' | 'low'
  idempotencyKey?: string
  async?: boolean
  sender?: string
}

export type ChannelDeliveryStatus = 'delivered' | 'queued' | 'skipped' | 'failed'

export interface ChannelDeliveryResult {
  channel: NotificationChannel
  status: ChannelDeliveryStatus
  messageId?: string
  error?: string
  provider?: string
  timestamp: number
}

export interface NotificationDeliveryResult {
  notificationId: string
  success: boolean
  results: ChannelDeliveryResult[]
  skippedChannels?: NotificationChannel[]
  errors?: Record<string, string>
}

export interface InAppNotification {
  id: string
  userId: string
  title: string
  body: string
  category: NotificationCategory
  read: boolean
  actionUrl?: string
  data?: Record<string, unknown>
  createdAt: number
  readAt?: number
}

export interface UserPreferences {
  userId: string
  channels: Partial<Record<NotificationChannel, boolean>>
  categories?: Partial<Record<NotificationCategory, boolean>>
}

export interface NotificationTemplate {
  id: string
  name: string
  category: NotificationCategory
  titleTemplate: string
  bodyTemplate: string
  htmlTemplate?: string
  requiredVariables?: string[]
}

export interface INotificationChannelProvider {
  channel: NotificationChannel
  send(
    recipient: Recipient,
    payload: NotificationPayload,
    options?: SendNotificationOptions
  ): Promise<ChannelDeliveryResult>
}

export interface IPreferenceStore {
  getUserPreferences(userId: string): Promise<UserPreferences | null> | UserPreferences | null
  setUserPreferences(preferences: UserPreferences): Promise<void> | void
  isChannelEnabled(
    userId: string,
    channel: NotificationChannel,
    category?: NotificationCategory
  ): Promise<boolean> | boolean
}

export interface IInAppStore {
  create(notification: InAppNotification): Promise<InAppNotification> | InAppNotification
  listForUser(
    userId: string,
    options?: { unreadOnly?: boolean; limit?: number; offset?: number }
  ): Promise<InAppNotification[]> | InAppNotification[]
  markAsRead(id: string, userId: string): Promise<boolean> | boolean
  markAllAsRead(userId: string): Promise<number> | number
  getUnreadCount(userId: string): Promise<number> | number
}
