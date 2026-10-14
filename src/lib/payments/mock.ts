import {
  CheckoutSessionOptions,
  CheckoutSessionResult,
  IPaymentProvider,
  PaymentStatus,
  PaymentStatusResult,
  WebhookEvent,
} from './types';
import {
  validateCurrency,
  validatePaymentAmount,
  validateReferenceId,
} from './validation';
import { randomBytes } from 'node:crypto';

interface StoredMockSession {
  sessionId: string;
  referenceId: string;
  amount: number;
  currency: string;
  customerEmail?: string;
  status: PaymentStatus;
  createdAt: string;
  paidAt?: string;
  metadata?: Record<string, string>;
}

/**
 * Deterministic Mock Payment Provider for offline development, local demos, and automated testing.
 * Operates without requiring real Stripe or Razorpay accounts or network access.
 */
export class MockPaymentProvider implements IPaymentProvider {
  readonly name = 'mock-payments';
  private sessions = new Map<string, StoredMockSession>();

  async createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutSessionResult> {
    // 1. Boundary validation
    const amountVal = validatePaymentAmount(options.amount);
    if (!amountVal.valid) {
      throw new Error(`Invalid payment amount: ${amountVal.error}`);
    }

    const currVal = validateCurrency(options.currency);
    if (!currVal.valid || !currVal.normalized) {
      throw new Error(`Invalid currency: ${currVal.error}`);
    }

    const refVal = validateReferenceId(options.referenceId);
    if (!refVal.valid || !refVal.sanitized) {
      throw new Error(`Invalid reference ID: ${refVal.error}`);
    }

    const sessionId = `mock_cs_${randomBytes(12).toString('hex')}`;
    const now = new Date().toISOString();

    const stored: StoredMockSession = {
      sessionId,
      referenceId: refVal.sanitized,
      amount: options.amount,
      currency: currVal.normalized,
      customerEmail: options.customerEmail,
      status: 'pending',
      createdAt: now,
      metadata: options.metadata,
    };

    this.sessions.set(sessionId, stored);

    // Build realistic mock checkout URL directing to successUrl or mock portal
    const urlSeparator = options.successUrl.includes('?') ? '&' : '?';
    const checkoutUrl = `${options.successUrl}${urlSeparator}session_id=${sessionId}&provider=mock`;

    return {
      sessionId,
      checkoutUrl,
      referenceId: refVal.sanitized,
      provider: this.name,
      status: 'pending',
    };
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResult> {
    if (!paymentId) {
      throw new Error('Payment ID is required to query payment status');
    }

    const stored = this.sessions.get(paymentId);
    if (stored) {
      return {
        paymentId: stored.sessionId,
        referenceId: stored.referenceId,
        status: stored.status,
        amount: stored.amount,
        currency: stored.currency,
        customerEmail: stored.customerEmail,
        paidAt: stored.paidAt,
        metadata: stored.metadata,
        rawProviderStatus: stored.status,
      };
    }

    // Fallback for mock IDs not present in memory
    return {
      paymentId,
      status: 'succeeded',
      amount: 1000,
      currency: 'USD',
      paidAt: new Date().toISOString(),
      rawProviderStatus: 'succeeded',
    };
  }

  /**
   * Helper to simulate status transitions (success, failure, cancellation) in tests and demos.
   */
  simulatePaymentStatus(paymentId: string, status: PaymentStatus): boolean {
    const session = this.sessions.get(paymentId);
    if (!session) return false;

    session.status = status;
    if (status === 'succeeded') {
      session.paidAt = new Date().toISOString();
    }
    return true;
  }

  /**
   * Generates a normalized mock webhook event payload for testing webhook listeners.
   */
  generateMockWebhookEvent(
    sessionId: string,
    eventType = 'checkout.session.completed'
  ): WebhookEvent {
    const session = this.sessions.get(sessionId) || {
      sessionId,
      referenceId: 'ref_sample',
      amount: 2500,
      currency: 'USD',
      status: 'succeeded',
      createdAt: new Date().toISOString(),
    };

    return {
      id: `evt_${randomBytes(10).toString('hex')}`,
      type: eventType,
      provider: this.name,
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        id: session.sessionId,
        object: 'checkout.session',
        client_reference_id: session.referenceId,
        amount_total: session.amount,
        currency: session.currency.toLowerCase(),
        payment_status: 'paid',
        status: 'complete',
        customer_email: session.customerEmail,
        metadata: session.metadata,
      },
      livemode: false,
    };
  }
}

export const sharedPaymentProvider = new MockPaymentProvider();
