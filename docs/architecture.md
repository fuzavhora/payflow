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

## Payment domain
PaymentIntent is a merchant request to collect an amount and currency. One intent may have multiple PaymentAttempts, each tied to one provider execution. Amounts are integer minor units and serialized as decimal strings; floating-point money arithmetic is prohibited. Creation requires an Idempotency-Key. The unique merchant/key constraint protects duplicate submissions. Reusing a key with a different request fingerprint returns a conflict.

The current create endpoint only creates a local PaymentIntent in requires_payment_method state. It does not authorize, capture, or move money.

## Reliability
Treat callbacks and webhooks as at-least-once. Use bounded exponential retries with jitter. Reconcile uncertain states against provider truth. Never promise exactly-once delivery.

## Security gaps
API key authentication protects payment routes. API key scope enforcement is implemented for PaymentIntent read/write. Rate limiting, audit events, key management UI, tenant-isolation integration tests, webhook verification, and production secrets management remain to be implemented. Do not expose live keys or use real payment traffic yet.

## Known gaps
Provider adapters, payment execution, refunds, webhook delivery, ledger, observability, and production deployment controls are not implemented. This repository is not production-ready.
