# PayFlow Architecture

**Status:** Initial implementation baseline.

PayFlow is a self-hostable payment application and orchestration layer. It coordinates operations across external providers. It is not a bank, acquirer, card network, or licensed payment processor. Never store raw PAN, CVV, PIN, or track data. Prefer provider-hosted checkout and tokenization.

## Initial topology
- Web: Next.js dashboard and public product surface.
- API: NestJS with versioned REST routes.
- Persistence: PostgreSQL is the source of truth.
- Queue: Redis + BullMQ for asynchronous work (worker not yet wired).
- Domain: merchants, customers, payment intents, attempts, refunds, subscriptions, invoices, and events.

## Architectural choice
Start with a modular monolith. Payment lifecycle, idempotency, transactions, and audit records need strong consistency boundaries. Premature microservices add distributed failure modes before domain boundaries and scale requirements are known.

## Payment domain
The initial schema separates PaymentIntent from PaymentAttempt: one intent may have multiple attempts, each tied to one provider execution. Idempotency records are merchant-scoped and protected by a database uniqueness constraint. Monetary values use integer minor units (BigInt) and an ISO currency code. Floating-point money arithmetic is prohibited.

## Reliability
Require idempotency keys for mutating payment commands. Persist domain changes and outbox events in one database transaction. Treat callbacks and webhooks as at-least-once. Use bounded exponential retries with jitter. Reconcile uncertain states against provider truth. Never promise exactly-once delivery.

## Security
Enforce tenant isolation at the data-access boundary. Hash API secrets at rest. Scope credentials by merchant and environment. Verify webhook signatures and timestamps. Redact tokens and payment data from logs. Use immutable audit records for privileged actions.

## Known gaps
Authentication, authorization, tenant enforcement, payment commands, provider adapters, webhook delivery, ledger, observability, and production deployment controls are not implemented. This repository is not production-ready.
