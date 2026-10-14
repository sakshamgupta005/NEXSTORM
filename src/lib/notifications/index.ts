/**
 * Reusable Notifications & Messaging Toolkit
 * 
 * Provides:
 * - Provider-neutral multi-channel dispatcher (`NotificationDispatcher`, `sharedNotificationDispatcher`)
 * - Channel providers:
 *   - Email (`ResendEmailProvider`, with zero-SDK REST and mock fallback)
 *   - In-app (`InAppChannelProvider`, `InMemoryInAppStore`, `sharedInAppStore`)
 *   - Realtime (`RealtimeChannelProvider`)
 *   - SMS (`SmsChannelProvider`)
 *   - Mock (`MockChannelProvider` for tests)
 * - Safe notification templates (`NotificationTemplateRegistry`, `sharedTemplateRegistry`, `escapeHtml`)
 * - User notification preferences & opt-outs (`InMemoryPreferenceStore`, `sharedPreferenceStore`)
 */

export * from './types'
export * from './templates'
export * from './preferences'
export * from './in-app'
export * from './channels/mock'
export * from './channels/resend'
export * from './channels/in-app'
export * from './channels/realtime'
export * from './channels/sms'
export * from './dispatcher'
