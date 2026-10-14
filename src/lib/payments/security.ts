import { createHmac, timingSafeEqual } from 'node:crypto';
import { WebhookSignatureOptions } from './types';

/**
 * Constant-time string equality check to prevent timing side-channel attacks.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');

  if (bufA.length !== bufB.length) {
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}

/**
 * Verifies Stripe webhook signatures (format: t=1700000000,v1=hexsignature).
 * Adheres to official Stripe webhook security specifications:
 * 1. Timestamp extraction and anti-replay tolerance check (default 5 min).
 * 2. HMAC-SHA256 computation over `${timestamp}.${rawPayload}`.
 * 3. Constant-time signature comparison.
 */
export function verifyStripeSignature(
  rawPayload: string | Buffer,
  signatureHeader: string,
  secret: string,
  options?: WebhookSignatureOptions
): { valid: boolean; timestamp?: number; error?: string } {
  if (!signatureHeader || !secret) {
    return { valid: false, error: 'Missing webhook signature header or secret' };
  }

  const payloadString = Buffer.isBuffer(rawPayload) ? rawPayload.toString('utf8') : rawPayload;
  const tolerance = options?.toleranceSeconds ?? 300; // 5 minutes

  // Parse header items (e.g. t=1700000000,v1=abc123...,v0=...)
  const items = signatureHeader.split(',').reduce<Record<string, string[]>>((acc, item) => {
    const [key, value] = item.trim().split('=');
    if (key && value) {
      acc[key] = acc[key] || [];
      acc[key].push(value);
    }
    return acc;
  }, {});

  const timestampStr = items.t?.[0];
  const signatures = items.v1 || [];

  if (!timestampStr || signatures.length === 0) {
    return { valid: false, error: 'Malformed Stripe signature header' };
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    return { valid: false, error: 'Invalid timestamp in signature header' };
  }

  // Anti-replay check
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > tolerance) {
    return { valid: false, timestamp, error: `Webhook timestamp expired (drift > ${tolerance}s)` };
  }

  // Compute expected HMAC-SHA256 signature
  const signedPayload = `${timestamp}.${payloadString}`;
  const expectedSignature = createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');

  // Verify against all v1 signatures in header
  const isMatch = signatures.some((sig) => timingSafeEqualStrings(sig, expectedSignature));

  if (!isMatch) {
    return { valid: false, timestamp, error: 'Signature mismatch' };
  }

  return { valid: true, timestamp };
}

/**
 * Generates valid Stripe webhook signature header for deterministic testing and mock dispatch.
 */
export function generateStripeSignature(
  rawPayload: string | Buffer,
  secret: string,
  timestamp?: number
): string {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const payloadString = Buffer.isBuffer(rawPayload) ? rawPayload.toString('utf8') : rawPayload;
  const signedPayload = `${ts}.${payloadString}`;
  const signature = createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');

  return `t=${ts},v1=${signature}`;
}

/**
 * Verifies standard HMAC-SHA256 signature (used by Razorpay and standard webhooks).
 */
export function verifyHmacSha256Signature(
  rawPayload: string | Buffer,
  expectedSignature: string,
  secret: string
): boolean {
  if (!rawPayload || !expectedSignature || !secret) return false;
  const payloadBuffer = Buffer.isBuffer(rawPayload) ? rawPayload : Buffer.from(rawPayload, 'utf8');

  const computed = createHmac('sha256', secret).update(payloadBuffer).digest('hex');
  return timingSafeEqualStrings(computed, expectedSignature);
}

/**
 * Verifies Standard Webhooks / Svix signature format:
 * Payload: `${msgId}.${timestamp}.${rawPayload}`
 */
export function verifyStandardWebhookSignature(
  rawPayload: string | Buffer,
  msgId: string,
  timestamp: string,
  signature: string,
  secret: string,
  options?: WebhookSignatureOptions
): { valid: boolean; error?: string } {
  if (!rawPayload || !msgId || !timestamp || !signature || !secret) {
    return { valid: false, error: 'Missing required webhook verification parameters' };
  }

  const tolerance = options?.toleranceSeconds ?? 300;
  const tsNumber = parseInt(timestamp, 10);
  if (isNaN(tsNumber)) {
    return { valid: false, error: 'Invalid timestamp' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - tsNumber) > tolerance) {
    return { valid: false, error: 'Webhook timestamp expired' };
  }

  const payloadString = Buffer.isBuffer(rawPayload) ? rawPayload.toString('utf8') : rawPayload;
  const toSign = `${msgId}.${timestamp}.${payloadString}`;
  const computed = createHmac('sha256', secret).update(toSign, 'utf8').digest('hex');

  const valid = timingSafeEqualStrings(computed, signature);
  return { valid, error: valid ? undefined : 'Signature mismatch' };
}
