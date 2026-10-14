import { describe, it, expect, beforeEach } from 'vitest'
import {
  NotificationDispatcher,
  NotificationTemplateRegistry,
  InMemoryPreferenceStore,
  InMemoryInAppStore,
  MockChannelProvider,
  ResendEmailProvider,
  InAppChannelProvider,
  RealtimeChannelProvider,
  SmsChannelProvider,
  escapeHtml,
  htmlToPlainText,
  isValidEmail,
  isValidE164Phone,
  type Recipient,
  type NotificationPayload,
} from '@/lib/notifications'

describe('Part 4.11 — Notifications & Messaging Toolkit', () => {
  let dispatcher: NotificationDispatcher
  let preferenceStore: InMemoryPreferenceStore
  let inAppStore: InMemoryInAppStore
  let templateRegistry: NotificationTemplateRegistry
  let mockEmail: MockChannelProvider
  let mockInApp: MockChannelProvider
  let mockRealtime: MockChannelProvider
  let mockSms: MockChannelProvider

  const sampleRecipient: Recipient = {
    id: 'usr_hackathon_1',
    email: 'developer@example.com',
    phone: '+14155552671',
    name: 'Ada Lovelace',
  }

  beforeEach(() => {
    preferenceStore = new InMemoryPreferenceStore()
    inAppStore = new InMemoryInAppStore()
    templateRegistry = new NotificationTemplateRegistry()

    dispatcher = new NotificationDispatcher({
      preferenceStore,
      templateRegistry,
      idempotencyTtlMs: 2000,
    })

    // Mount dedicated mock providers for testing
    mockEmail = new MockChannelProvider('email')
    mockInApp = new MockChannelProvider('in_app')
    mockRealtime = new MockChannelProvider('realtime')
    mockSms = new MockChannelProvider('sms')

    dispatcher.registerProvider(mockEmail)
    dispatcher.registerProvider(mockInApp)
    dispatcher.registerProvider(mockRealtime)
    dispatcher.registerProvider(mockSms)
  })

  describe('1. Template Rendering & XSS Safety', () => {
    it('escapes dangerous HTML characters to prevent XSS injection in templates', () => {
      const malicious = '<script>alert("xss")</script>&"test"\''
      const escaped = escapeHtml(malicious)
      expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&amp;&quot;test&quot;&#39;')
      expect(escaped).not.toContain('<script>')
    })

    it('extracts clean plain text from HTML content', () => {
      const html = '<h1>Welcome!</h1><p>Your code is <b>123456</b>.<br/>Click &nbsp; here.</p>'
      const plain = htmlToPlainText(html)
      expect(plain).toBe('Welcome! Your code is 123456. Click here.')
    })

    it('renders named template with variable substitution', () => {
      const rendered = templateRegistry.render('welcome_email', {
        name: 'Grace Hopper',
        appUrl: 'https://hackathon.dev',
      })

      expect(rendered.title).toBe('Welcome to Hackathon Starter, Grace Hopper!')
      expect(rendered.body).toContain('Hi Grace Hopper')
      expect(rendered.html).toContain('<h1>Welcome, Grace Hopper!</h1>')
    })

    it('throws validation error when required template variables are missing', () => {
      expect(() => {
        templateRegistry.render('welcome_email', { name: 'Grace' })
      }).toThrow(/missing required variables: appUrl/)
    })
  })

  describe('2. Multi-Channel Dispatch & Missing Provider Handling', () => {
    it('dispatches to multiple channels simultaneously and returns structured results', async () => {
      const payload: NotificationPayload = {
        title: 'Project Submission Ready',
        body: 'Your hackathon project draft is saved and ready for review.',
        category: 'transactional',
      }

      const outcome = await dispatcher.send(sampleRecipient, payload, {
        channels: ['email', 'in_app', 'realtime'],
      })

      expect(outcome.success).toBe(true)
      expect(outcome.results).toHaveLength(3)

      expect(mockEmail.getSentMessages()).toHaveLength(1)
      expect(mockInApp.getSentMessages()).toHaveLength(1)
      expect(mockRealtime.getSentMessages()).toHaveLength(1)
      expect(mockSms.getSentMessages()).toHaveLength(0)
    })

    it('handles channels without registered providers gracefully without crashing', async () => {
      const customDispatcher = new NotificationDispatcher({ preferenceStore })
      // Clear all providers
      // @ts-expect-error accessing private for test
      customDispatcher.providers.clear()

      const outcome = await customDispatcher.send(sampleRecipient, {
        title: 'Notice',
        body: 'Test',
      }, { channels: ['email'] })

      expect(outcome.success).toBe(false)
      expect(outcome.errors?.email).toContain("No provider registered for channel 'email'")
    })
  })

  describe('3. User Preferences & Opt-Out Policies', () => {
    it('skips disabled channels when user opts out of marketing notifications', async () => {
      preferenceStore.setUserPreferences({
        userId: sampleRecipient.id,
        channels: {
          email: false, // Opted out of emails
          in_app: true,
        },
      })

      const outcome = await dispatcher.send(sampleRecipient, {
        title: 'New Feature Announcement',
        body: 'Check out our new AI search capabilities.',
        category: 'marketing',
      }, { channels: ['email', 'in_app'] })

      expect(outcome.skippedChannels).toContain('email')
      expect(mockEmail.getSentMessages()).toHaveLength(0)
      expect(mockInApp.getSentMessages()).toHaveLength(1)
    })

    it('forces delivery of security alerts even if user has email disabled', async () => {
      preferenceStore.setUserPreferences({
        userId: sampleRecipient.id,
        channels: { email: false }, // User attempted to disable email
      })

      const outcome = await dispatcher.send(sampleRecipient, {
        title: 'Unrecognized Device Login',
        body: 'Someone logged into your account from a new IP.',
        category: 'security', // Non-opt-outable security notice
      }, { channels: ['email'] })

      // Must NOT skip security notices!
      expect(outcome.skippedChannels).toBeUndefined()
      expect(mockEmail.getSentMessages()).toHaveLength(1)
    })
  })

  describe('4. Idempotency & Deduplication', () => {
    it('returns memoized result and suppresses duplicate sends with same idempotencyKey', async () => {
      const payload: NotificationPayload = {
        title: 'Order Confirmation',
        body: 'Payment of $50 confirmed',
      }

      const res1 = await dispatcher.send(sampleRecipient, payload, {
        channels: ['email'],
        idempotencyKey: 'idemp_order_101',
      })

      const res2 = await dispatcher.send(sampleRecipient, payload, {
        channels: ['email'],
        idempotencyKey: 'idemp_order_101',
      })

      expect(res1.notificationId).toBe(res2.notificationId)
      // Only 1 actual message dispatched through provider!
      expect(mockEmail.getSentMessages()).toHaveLength(1)
    })
  })

  describe('5. Persistent In-App Store & Inbox Operations', () => {
    it('creates, queries, and marks in-app notifications as read', async () => {
      const realInAppProvider = new InAppChannelProvider(inAppStore)
      const testDispatcher = new NotificationDispatcher({ preferenceStore })
      testDispatcher.registerProvider(realInAppProvider)

      await testDispatcher.send(sampleRecipient, {
        title: 'Build Complete',
        body: 'Your Docker container built successfully.',
        category: 'system',
      }, { channels: ['in_app'] })

      await testDispatcher.send(sampleRecipient, {
        title: 'Deployment Ready',
        body: 'Your app is live on port 3000.',
        category: 'system',
      }, { channels: ['in_app'] })

      // Verify unread count
      expect(inAppStore.getUnreadCount(sampleRecipient.id)).toBe(2)

      // Query inbox
      const items = inAppStore.listForUser(sampleRecipient.id)
      expect(items).toHaveLength(2)
      expect(items[0].read).toBe(false)

      // Mark one as read
      const marked = inAppStore.markAsRead(items[0].id, sampleRecipient.id)
      expect(marked).toBe(true)
      expect(inAppStore.getUnreadCount(sampleRecipient.id)).toBe(1)

      // Mark remaining as read in batch
      const batchCount = inAppStore.markAllAsRead(sampleRecipient.id)
      expect(batchCount).toBe(1)
      expect(inAppStore.getUnreadCount(sampleRecipient.id)).toBe(0)
    })
  })

  describe('6. Realtime Channel & Live Pushes', () => {
    it('emits live push notifications to registered subscribers', async () => {
      const realtimeProvider = new RealtimeChannelProvider()
      const receivedPushes: string[] = []

      const unsubscribe = realtimeProvider.subscribe((recipient, payload, messageId) => {
        receivedPushes.push(`${recipient.name}: ${payload.title} (${messageId})`)
      })

      await realtimeProvider.send(sampleRecipient, {
        title: 'New Comment',
        body: 'Someone commented on your PR.',
      })

      expect(receivedPushes).toHaveLength(1)
      expect(receivedPushes[0]).toContain('Ada Lovelace: New Comment')

      unsubscribe()
      await realtimeProvider.send(sampleRecipient, {
        title: 'Second Comment',
        body: 'Another message',
      })
      // No more pushes received after unsubscription
      expect(receivedPushes).toHaveLength(1)
    })
  })

  describe('7. Recipient Format Validation (Email & SMS)', () => {
    it('validates email formats and rejects invalid addresses', () => {
      expect(isValidEmail('valid.user@company.co')).toBe(true)
      expect(isValidEmail('plainaddress')).toBe(false)
      expect(isValidEmail('missing@domain')).toBe(false)
      expect(isValidEmail('')).toBe(false)
    })

    it('validates E.164 phone formats and rejects invalid numbers', () => {
      expect(isValidE164Phone('+14155552671')).toBe(true)
      expect(isValidE164Phone('+442071838750')).toBe(true)
      expect(isValidE164Phone('555-2671')).toBe(false)
      expect(isValidE164Phone('14155552671')).toBe(false) // Missing leading +
      expect(isValidE164Phone('')).toBe(false)
    })

    it('Resend provider returns structured failure on invalid email without throwing', async () => {
      const resend = new ResendEmailProvider()
      const result = await resend.send(
        { id: 'usr_bad', email: 'not-an-email' },
        { title: 'Test', body: 'Test' }
      )
      expect(result.status).toBe('failed')
      expect(result.error).toContain('Invalid recipient email address')
    })

    it('SMS provider returns structured failure on invalid phone format', async () => {
      const sms = new SmsChannelProvider()
      const result = await sms.send(
        { id: 'usr_bad', phone: 'invalid-phone' },
        { title: 'Test', body: 'Test' }
      )
      expect(result.status).toBe('failed')
      expect(result.error).toContain('Must follow E.164 format')
    })
  })

  describe('8. Provider Failure Simulation & Recovery', () => {
    it('records provider failures in delivery results when provider fails', async () => {
      mockEmail.setFailure(true, 'SMTP timeout connection refused')

      const outcome = await dispatcher.send(sampleRecipient, {
        title: 'Alert',
        body: 'Message',
      }, { channels: ['email', 'in_app'] })

      expect(outcome.errors?.email).toContain('SMTP timeout connection refused')
      expect(outcome.results.find((r) => r.channel === 'email')?.status).toBe('failed')
      // in_app should still succeed independently
      expect(outcome.results.find((r) => r.channel === 'in_app')?.status).toBe('delivered')
    })
  })
})
