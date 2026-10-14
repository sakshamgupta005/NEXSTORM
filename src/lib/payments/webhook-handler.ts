import {
  IIdempotencyStore,
  WebhookEvent,
  WebhookProcessResult,
} from './types';
import { sharedIdempotencyStore } from './idempotency';
import { verifyStripeSignature } from './security';

export type WebhookEventHandler<T = unknown> = (
  event: WebhookEvent<T>
) => Promise<void> | void;

export interface WebhookHandlerOptions {
  idempotencyStore?: IIdempotencyStore;
  idempotencyTtlSeconds?: number;
}

/**
 * Idempotent Webhook Processing Engine.
 * Verifies signatures, guards against duplicate event replay attacks, and routes events to handlers safely.
 */
export class IdempotentWebhookHandler {
  private handlers = new Map<string, Set<WebhookEventHandler<unknown>>>();
  private idempotencyStore: IIdempotencyStore;
  private idempotencyTtlSeconds: number;

  constructor(options?: WebhookHandlerOptions) {
    this.idempotencyStore = options?.idempotencyStore || sharedIdempotencyStore;
    this.idempotencyTtlSeconds = options?.idempotencyTtlSeconds ?? 86_400; // 24 hours
  }

  /**
   * Registers a callback listener for a specific webhook event type or '*' wildcard.
   */
  on<T = Record<string, unknown>>(
    eventType: string,
    handler: WebhookEventHandler<T>
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    const set = this.handlers.get(eventType)!;
    set.add(handler as WebhookEventHandler<unknown>);

    return () => {
      set.delete(handler as WebhookEventHandler<unknown>);
    };
  }

  /**
   * Processes a verified webhook event with idempotency guarantees.
   */
  async processEvent(event: WebhookEvent<unknown>): Promise<WebhookProcessResult> {
    if (!event || !event.id || !event.type) {
      return {
        status: 'failed',
        error: 'Malformed webhook event: missing event id or type',
      };
    }

    // 1. Idempotency Check: Guard against duplicate delivery replay
    const isDuplicate = await this.idempotencyStore.has(event.id);
    if (isDuplicate) {
      return {
        status: 'duplicate',
        eventId: event.id,
        eventType: event.type,
        message: `Event "${event.id}" already processed; side effects suppressed.`,
      };
    }

    // 2. Resolve listeners for this event type and '*' wildcard
    const specificHandlers = this.handlers.get(event.type) || new Set();
    const wildcardHandlers = this.handlers.get('*') || new Set();

    if (specificHandlers.size === 0 && wildcardHandlers.size === 0) {
      // Mark as processed so unhandled events are acknowledged and not retried endlessly
      await this.idempotencyStore.markProcessed(event.id, this.idempotencyTtlSeconds);
      return {
        status: 'unsupported',
        eventId: event.id,
        eventType: event.type,
        message: `No handlers registered for event type "${event.type}".`,
      };
    }

    // 3. Execute handlers within try/catch isolation
    try {
      for (const handler of specificHandlers) {
        await handler(event);
      }
      for (const handler of wildcardHandlers) {
        await handler(event);
      }

      // 4. Mark event ID as successfully processed in idempotency store
      await this.idempotencyStore.markProcessed(event.id, this.idempotencyTtlSeconds);

      return {
        status: 'processed',
        eventId: event.id,
        eventType: event.type,
        message: `Successfully processed event "${event.id}".`,
      };
    } catch (err) {
      return {
        status: 'failed',
        eventId: event.id,
        eventType: event.type,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Complete Stripe Webhook Pipeline:
   * 1. Verifies cryptographic signature using raw payload and secret.
   * 2. Deserializes event JSON safely.
   * 3. Executes processEvent with idempotency deduplication.
   */
  async handleStripeWebhook(
    rawPayload: string | Buffer,
    signatureHeader: string,
    secret: string
  ): Promise<WebhookProcessResult> {
    // 1. Cryptographic signature verification
    const verification = verifyStripeSignature(rawPayload, signatureHeader, secret);
    if (!verification.valid) {
      return {
        status: 'failed',
        error: `Webhook signature verification failed: ${verification.error}`,
      };
    }

    // 2. Parse raw payload to JSON
    let parsed: Record<string, unknown>;
    try {
      const payloadString = Buffer.isBuffer(rawPayload) ? rawPayload.toString('utf8') : rawPayload;
      parsed = JSON.parse(payloadString) as Record<string, unknown>;
    } catch {
      return {
        status: 'failed',
        error: 'Invalid JSON payload received in webhook body',
      };
    }

    const event: WebhookEvent = {
      id: String(parsed.id || ''),
      type: String(parsed.type || ''),
      provider: 'stripe',
      timestamp: Number(parsed.created || verification.timestamp || Math.floor(Date.now() / 1000)),
      data: ((parsed.data as Record<string, unknown>)?.object || parsed.data || {}) as Record<string, unknown>,
      livemode: Boolean(parsed.livemode),
    };

    return this.processEvent(event);
  }
}

export const sharedWebhookHandler = new IdempotentWebhookHandler();
