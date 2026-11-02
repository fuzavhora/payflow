# PayFlow Architecture

**Status:** Initial implementation baseline.

PayFlow is a self-hostable payment application and orchestration layer. It coordinates operations across external providers. It is not a bank, acquirer, card network, or licensed payment processor. Never store raw PAN, CVV, PIN, or track data. Prefer provider-hosted checkout and tokenization.

## Initial topology
- Web: Next.js dashboard and public product surface.
- API: NestJS with versioned REST routes.
- Persistence: PostgreSQL is the source of truth.
- Queue: Redis + BullMQ for asynchronous work (worker not yet wired).
- Domain: merchants, customers, payment intents, attempts, refunds, subscriptions, invoices, and events.

## Authentication and tenancy
Payment API routes require a merchant API key in the Bearer authorization header. Keys use high-entropy random material; only SHA-256 hashes are stored. An indexed public prefix locates the hash record, and the supplied key is compared using a constant-time digest comparison. Merchant identity is resolved server-side from the verified key. The key's encoded test/live environment must match its database record. Routes declare required scopes and the guard enforces them. API keys can be expired or revoked in storage; management endpoints are not yet implemented.

Customers are unique by normalized email within a merchant. PaymentIntent creation validates customer ownership in application logic. The Prisma schema models the PaymentIntent-to-Customer relation as a composite foreign key over `(merchantId, customerId)` -> `(merchantId, id)`, so PostgreSQL can reject cross-merchant customer references.

## Payment domain
PaymentIntent is a merchant request to collect an amount and currency. One intent may have multiple PaymentAttempts, each tied to one provider execution. Amounts are integer minor units and serialized as decimal strings; floating-point money arithmetic is prohibited. Creation requires a merchant-scoped `Idempotency-Key`. Reusing a key with a different request fingerprint returns a conflict.

The current create endpoint only creates a local PaymentIntent in `requires_payment_method` state. It does not authorize, capture, or move money.

## State machine and provider boundary
The pure PaymentIntent state transition policy lives under `apps/api/src/payments/domain`. The internal transition service uses merchant-scoped conditional updates to prevent concurrent state overwrites.

The internal PaymentAttempt service commits a `CREATED` attempt and moves an intent to `PROCESSING` in one database transaction. Provider network calls must happen after this transaction commits. Normalized provider results are persisted in a separate transaction; definitive success/failure updates the PaymentIntent atomically with the attempt. Pending/unknown outcomes remain processing for later reconciliation.

The provider-neutral contract lives under `apps/api/src/payments/providers`. No concrete provider adapter or provider execution wiring is currently configured. Customer-action results are not yet supported because the state model lacks a dedicated action lifecycle.

## Transactional events
PaymentAttempt state changes and their outbox events are committed in the same PostgreSQL transaction. The outbox has merchant-scoped deduplication keys and supports pending, processing, published, and dead-letter states. Event payloads contain normalized identifiers and status metadata only. A dispatcher and webhook delivery worker are not implemented, so persisted events are not yet delivered. See [Transactional Outbox](transactional-outbox.md).

## Reliability
Treat callbacks and webhooks as at-least-once. Use bounded exponential retries with jitter. Reconcile uncertain states against provider truth. Never promise exactly-once delivery. Persist an attempt before external network calls and use an outbox for committed domain events.

## Security gaps
API key authentication and scope enforcement are implemented. Rate limiting, audit events, key management UI, webhook verification, and production secrets management remain to be implemented. Do not expose live keys or use real payment traffic yet.

## Known gaps
Concrete provider adapters, payment execution, refunds, webhook delivery, ledger, observability, and production deployment controls are not implemented. This repository is not production-ready.
