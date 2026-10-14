/**
 * Reusable Payments & Webhook Toolkit Types & Contracts
 * 
 * Inspired by Stripe, Razorpay, Svix, and Standard Webhooks patterns.
 */

export type PaymentStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'refunded';

export interface CheckoutItem {
  name: string;
  amount: number; // in integer minor units (e.g. cents for USD/EUR, paise for INR)
  quantity: number;
  description?: string;
}

export interface CheckoutSessionOptions {
  referenceId: string; // Application-owned ID (e.g., order_123, booking_abc)
  amount: number; // Total amount in integer minor units (e.g. 2500 = $25.00)
  currency: string; // 3-letter ISO code e.g. "USD", "EUR", "INR", "GBP"
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  items?: CheckoutItem[];
  metadata?: Record<string, string>;
}

export interface CheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
  referenceId: string;
  provider: string;
  status: PaymentStatus;
}

export interface PaymentStatusResult {
  paymentId: string;
  referenceId?: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  customerEmail?: string;
  paidAt?: string;
  metadata?: Record<string, string>;
  rawProviderStatus?: string;
}

export interface IPaymentProvider {
  readonly name: string;
  createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutSessionResult>;
  getPaymentStatus(paymentId: string): Promise<PaymentStatusResult>;
}

export interface WebhookEvent<T = Record<string, unknown>> {
  id: string; // Unique provider event identifier used for idempotency deduplication
  type: string; // e.g., 'checkout.session.completed', 'payment.succeeded'
  provider: string;
  timestamp: number;
  data: T;
  livemode?: boolean;
}

export interface WebhookSignatureOptions {
  toleranceSeconds?: number; // Anti-replay attack tolerance window (default 300s = 5m)
}

export interface IIdempotencyStore {
  has(eventId: string): Promise<boolean>;
  markProcessed(eventId: string, ttlSeconds?: number): Promise<void>;
  clear?(): Promise<void>;
}

export type WebhookProcessStatus = 'processed' | 'duplicate' | 'unsupported' | 'failed';

export interface WebhookProcessResult {
  status: WebhookProcessStatus;
  eventId?: string;
  eventType?: string;
  message?: string;
  error?: string;
}
