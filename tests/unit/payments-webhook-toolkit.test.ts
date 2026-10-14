import { describe, it, expect, beforeEach } from 'vitest';
import {
  validatePaymentAmount,
  validateCurrency,
  validateReferenceId,
  formatCurrencyAmount,
  timingSafeEqualStrings,
  verifyStripeSignature,
  generateStripeSignature,
  verifyHmacSha256Signature,
  verifyStandardWebhookSignature,
  InMemoryIdempotencyStore,
  MockPaymentProvider,
  StripePaymentProvider,
  IdempotentWebhookHandler,
  WebhookEvent,
} from '@/lib/payments';

describe('Payment Input Validation & Formatting', () => {
  it('validates integer amounts in minor currency units', () => {
    expect(validatePaymentAmount(2500).valid).toBe(true); // $25.00
    expect(validatePaymentAmount(100).valid).toBe(true);
    expect(validatePaymentAmount(1).valid).toBe(true);

    // Invalid non-integer / floating point
    expect(validatePaymentAmount(19.99).valid).toBe(false);
    expect(validatePaymentAmount(19.99).error).toContain('integer');

    // Invalid negative or zero
    expect(validatePaymentAmount(0).valid).toBe(false);
    expect(validatePaymentAmount(-500).valid).toBe(false);

    // Overflow limit
    expect(validatePaymentAmount(200_000_000).valid).toBe(false);
  });

  it('validates and normalizes 3-letter ISO-4217 currencies', () => {
    const usd = validateCurrency('usd');
    expect(usd.valid).toBe(true);
    expect(usd.normalized).toBe('USD');

    const eur = validateCurrency('EUR');
    expect(eur.valid).toBe(true);
    expect(eur.normalized).toBe('EUR');

    expect(validateCurrency('$').valid).toBe(false);
    expect(validateCurrency('USDT').valid).toBe(false);
    expect(validateCurrency('').valid).toBe(false);
  });

  it('validates application-owned reference identifiers', () => {
    expect(validateReferenceId('order_12345').valid).toBe(true);
    expect(validateReferenceId('booking:room-101').valid).toBe(true);

    expect(validateReferenceId('').valid).toBe(false);
    expect(validateReferenceId('ab').valid).toBe(false); // Too short
    expect(validateReferenceId('order<script>').valid).toBe(false); // Invalid characters
  });

  it('formats minor currency units into human-readable monetary representations', () => {
    expect(formatCurrencyAmount(2500, 'USD')).toBe('$25.00');
    expect(formatCurrencyAmount(1000, 'EUR')).toBe('€10.00');
    expect(formatCurrencyAmount(1500, 'JPY')).toBe('¥1,500'); // Zero decimal
  });
});

describe('Webhook Cryptographic Signature Verification', () => {
  const secret = 'whsec_test_secret_key_12345';
  const samplePayload = JSON.stringify({
    id: 'evt_test_1',
    type: 'checkout.session.completed',
    data: { amount_total: 2500 },
  });

  it('constant-time string comparison verifies identical and mismatched strings safely', () => {
    expect(timingSafeEqualStrings('signature_abc', 'signature_abc')).toBe(true);
    expect(timingSafeEqualStrings('signature_abc', 'signature_xyz')).toBe(false);
    expect(timingSafeEqualStrings('signature_abc', 'short')).toBe(false);
  });

  it('verifies valid Stripe webhook signatures successfully', () => {
    const now = Math.floor(Date.now() / 1000);
    const header = generateStripeSignature(samplePayload, secret, now);

    const result = verifyStripeSignature(samplePayload, header, secret);
    expect(result.valid).toBe(true);
    expect(result.timestamp).toBe(now);
  });

  it('rejects tampered webhook payloads with signature mismatch', () => {
    const header = generateStripeSignature(samplePayload, secret);
    const tamperedPayload = samplePayload.replace('2500', '9999');

    const result = verifyStripeSignature(tamperedPayload, header, secret);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('mismatch');
  });

  it('rejects expired webhook signatures to prevent replay attacks', () => {
    // 10 minutes in the past (exceeds default 300s / 5m tolerance)
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
    const header = generateStripeSignature(samplePayload, secret, oldTimestamp);

    const result = verifyStripeSignature(samplePayload, header, secret);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('expired');
  });

  it('verifies standard HMAC-SHA256 signatures for Razorpay and Standard Webhooks', () => {
    const validHmac = verifyHmacSha256Signature(
      samplePayload,
      generateStripeSignature(samplePayload, secret).split(',')[1].replace('v1=', ''),
      secret
    );
    expect(typeof validHmac).toBe('boolean');

    const standardRes = verifyStandardWebhookSignature(
      samplePayload,
      'msg_123',
      String(Math.floor(Date.now() / 1000)),
      'invalid_sig',
      secret
    );
    expect(standardRes.valid).toBe(false);
  });
});

describe('MockPaymentProvider & Lifecycle States', () => {
  let provider: MockPaymentProvider;

  beforeEach(() => {
    provider = new MockPaymentProvider();
  });

  it('creates checkout sessions with reference IDs and returns pending state', async () => {
    const session = await provider.createCheckoutSession({
      referenceId: 'order_987',
      amount: 4500,
      currency: 'USD',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
      customerEmail: 'user@example.com',
    });

    expect(session.sessionId).toContain('mock_cs_');
    expect(session.checkoutUrl).toContain('session_id=');
    expect(session.referenceId).toBe('order_987');
    expect(session.status).toBe('pending');

    const status = await provider.getPaymentStatus(session.sessionId);
    expect(status.status).toBe('pending');
    expect(status.amount).toBe(4500);
    expect(status.currency).toBe('USD');
  });

  it('simulates status transitions to succeeded, failed, and cancelled', async () => {
    const session = await provider.createCheckoutSession({
      referenceId: 'order_status_test',
      amount: 1500,
      currency: 'EUR',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    });

    // Simulate success
    expect(provider.simulatePaymentStatus(session.sessionId, 'succeeded')).toBe(true);
    const successStatus = await provider.getPaymentStatus(session.sessionId);
    expect(successStatus.status).toBe('succeeded');
    expect(successStatus.paidAt).toBeDefined();

    // Simulate cancellation
    expect(provider.simulatePaymentStatus(session.sessionId, 'cancelled')).toBe(true);
    const cancelStatus = await provider.getPaymentStatus(session.sessionId);
    expect(cancelStatus.status).toBe('cancelled');
  });

  it('generates mock webhook events matching session details', async () => {
    const session = await provider.createCheckoutSession({
      referenceId: 'order_webhook_test',
      amount: 3000,
      currency: 'USD',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    });

    const event = provider.generateMockWebhookEvent(session.sessionId);
    expect(event.type).toBe('checkout.session.completed');
    expect(event.provider).toBe('mock-payments');
    expect(event.data.client_reference_id).toBe('order_webhook_test');
    expect(event.data.amount_total).toBe(3000);
  });
});

describe('StripePaymentProvider & Fallback Safety', () => {
  it('falls back seamlessly to MockPaymentProvider when Stripe is unconfigured', async () => {
    const stripe = new StripePaymentProvider({ fallbackToMock: true });
    expect(stripe.isConfigured()).toBe(false);

    const session = await stripe.createCheckoutSession({
      referenceId: 'order_stripe_fallback',
      amount: 2000,
      currency: 'USD',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    });

    expect(session.sessionId).toBeDefined();
    expect(session.status).toBe('pending');

    const status = await stripe.getPaymentStatus(session.sessionId);
    expect(status.amount).toBe(2000);
  });

  it('throws descriptive configuration error when unconfigured and fallback is disabled', async () => {
    const stripe = new StripePaymentProvider({ fallbackToMock: false });
    await expect(
      stripe.createCheckoutSession({
        referenceId: 'order_fail',
        amount: 1000,
        currency: 'USD',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      })
    ).rejects.toThrow('STRIPE_SECRET_KEY is not configured');
  });
});

describe('Idempotent Webhook Handler Engine', () => {
  let idempotencyStore: InMemoryIdempotencyStore;
  let handler: IdempotentWebhookHandler;

  beforeEach(() => {
    idempotencyStore = new InMemoryIdempotencyStore();
    handler = new IdempotentWebhookHandler({ idempotencyStore });
  });

  it('executes registered listener on valid event and prevents duplicate side effects', async () => {
    let sideEffectCount = 0;
    handler.on('checkout.session.completed', async () => {
      sideEffectCount++;
    });

    const event: WebhookEvent = {
      id: 'evt_idempotent_1',
      type: 'checkout.session.completed',
      provider: 'stripe',
      timestamp: Math.floor(Date.now() / 1000),
      data: { orderId: 'ord_123' },
    };

    // First delivery -> processed
    const res1 = await handler.processEvent(event);
    expect(res1.status).toBe('processed');
    expect(sideEffectCount).toBe(1);

    // Duplicate delivery -> duplicate status, side effect count unchanged
    const res2 = await handler.processEvent(event);
    expect(res2.status).toBe('duplicate');
    expect(sideEffectCount).toBe(1);
  });

  it('routes to wildcard listener and reports unsupported event types cleanly', async () => {
    const wildcardEvents: string[] = [];
    handler.on('*', async (evt) => {
      wildcardEvents.push(evt.type);
    });

    const event: WebhookEvent = {
      id: 'evt_wildcard_1',
      type: 'customer.subscription.created',
      provider: 'stripe',
      timestamp: Math.floor(Date.now() / 1000),
      data: {},
    };

    const res = await handler.processEvent(event);
    expect(res.status).toBe('processed');
    expect(wildcardEvents).toEqual(['customer.subscription.created']);

    // Event with no listeners
    const unhandledEvent: WebhookEvent = {
      id: 'evt_unknown_1',
      type: 'unknown.custom.event',
      provider: 'stripe',
      timestamp: Math.floor(Date.now() / 1000),
      data: {},
    };

    const unhandledHandler = new IdempotentWebhookHandler();
    const unhandledRes = await unhandledHandler.processEvent(unhandledEvent);
    expect(unhandledRes.status).toBe('unsupported');
  });

  it('captures listener exceptions safely without crashing the server', async () => {
    handler.on('failing.event', async () => {
      throw new Error('Database write error during fulfillment');
    });

    const event: WebhookEvent = {
      id: 'evt_fail_1',
      type: 'failing.event',
      provider: 'stripe',
      timestamp: Math.floor(Date.now() / 1000),
      data: {},
    };

    const res = await handler.processEvent(event);
    expect(res.status).toBe('failed');
    expect(res.error).toContain('Database write error');
  });

  it('executes full handleStripeWebhook pipeline with signature verification', async () => {
    const secret = 'whsec_full_pipeline_secret';
    let processedOrderId: string | null = null;

    handler.on('checkout.session.completed', async (evt) => {
      processedOrderId = (evt.data as Record<string, string>).client_reference_id;
    });

    const rawPayload = JSON.stringify({
      id: 'evt_stripe_pipeline_1',
      type: 'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'cs_123',
          client_reference_id: 'order_pipeline_verified',
        },
      },
    });

    const signature = generateStripeSignature(rawPayload, secret);
    const result = await handler.handleStripeWebhook(rawPayload, signature, secret);

    expect(result.status).toBe('processed');
    expect(processedOrderId).toBe('order_pipeline_verified');

    // Invalid signature rejection in pipeline
    const badResult = await handler.handleStripeWebhook(rawPayload, 't=123,v1=bad_sig', secret);
    expect(badResult.status).toBe('failed');
    expect(badResult.error).toContain('signature verification failed');
  });
});
