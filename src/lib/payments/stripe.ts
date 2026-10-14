import {
  CheckoutSessionOptions,
  CheckoutSessionResult,
  IPaymentProvider,
  PaymentStatus,
  PaymentStatusResult,
} from './types';
import {
  validateCurrency,
  validatePaymentAmount,
  validateReferenceId,
} from './validation';
import { MockPaymentProvider } from './mock';

export interface StripeProviderConfig {
  secretKey?: string;
  webhookSecret?: string;
  fallbackToMock?: boolean;
}

/**
 * Stripe Payment Provider.
 * Integrates directly with Stripe REST API endpoints without requiring heavy SDK binaries.
 * Automatically falls back to resilient MockPaymentProvider when unconfigured.
 */
export class StripePaymentProvider implements IPaymentProvider {
  readonly name = 'stripe';
  private secretKey?: string;
  private fallback: MockPaymentProvider;
  private fallbackEnabled: boolean;

  constructor(config?: StripeProviderConfig) {
    this.secretKey = config?.secretKey || process.env.STRIPE_SECRET_KEY;
    this.fallbackEnabled = config?.fallbackToMock !== false;
    this.fallback = new MockPaymentProvider();
  }

  isConfigured(): boolean {
    return Boolean(this.secretKey && this.secretKey.startsWith('sk_'));
  }

  async createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutSessionResult> {
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

    if (!this.isConfigured()) {
      if (this.fallbackEnabled) {
        return this.fallback.createCheckoutSession(options);
      }
      throw new Error('STRIPE_SECRET_KEY is not configured and fallback is disabled');
    }

    try {
      const params = new URLSearchParams();
      params.append('mode', 'payment');
      params.append('success_url', options.successUrl);
      params.append('cancel_url', options.cancelUrl);
      params.append('client_reference_id', refVal.sanitized);

      if (options.customerEmail) {
        params.append('customer_email', options.customerEmail);
      }

      // Line items
      const itemName = options.items?.[0]?.name || `Payment ${refVal.sanitized}`;
      params.append('line_items[0][price_data][currency]', currVal.normalized.toLowerCase());
      params.append('line_items[0][price_data][product_data][name]', itemName);
      params.append('line_items[0][price_data][unit_amount]', String(options.amount));
      params.append('line_items[0][quantity]', '1');

      if (options.metadata) {
        for (const [key, value] of Object.entries(options.metadata)) {
          params.append(`metadata[${key}]`, value);
        }
      }

      const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        if (this.fallbackEnabled) {
          return this.fallback.createCheckoutSession(options);
        }
        const errJson = await response.json().catch(() => ({}));
        throw new Error(`Stripe API error: ${errJson.error?.message || response.statusText}`);
      }

      const session = await response.json();

      return {
        sessionId: session.id,
        checkoutUrl: session.url,
        referenceId: refVal.sanitized,
        provider: this.name,
        status: 'pending',
      };
    } catch (err) {
      if (this.fallbackEnabled) {
        return this.fallback.createCheckoutSession(options);
      }
      throw err;
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResult> {
    if (!this.isConfigured()) {
      if (this.fallbackEnabled) {
        return this.fallback.getPaymentStatus(paymentId);
      }
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    try {
      const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${paymentId}`, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      });

      if (!response.ok) {
        if (this.fallbackEnabled) {
          return this.fallback.getPaymentStatus(paymentId);
        }
        throw new Error(`Stripe API query failed: ${response.statusText}`);
      }

      const session = await response.json();
      let status: PaymentStatus = 'pending';

      if (session.payment_status === 'paid' || session.status === 'complete') {
        status = 'succeeded';
      } else if (session.status === 'expired') {
        status = 'cancelled';
      }

      return {
        paymentId: session.id,
        referenceId: session.client_reference_id,
        status,
        amount: session.amount_total ?? 0,
        currency: (session.currency ?? 'usd').toUpperCase(),
        customerEmail: session.customer_details?.email || session.customer_email,
        metadata: session.metadata,
        rawProviderStatus: session.status,
      };
    } catch (err) {
      if (this.fallbackEnabled) {
        return this.fallback.getPaymentStatus(paymentId);
      }
      throw err;
    }
  }
}
