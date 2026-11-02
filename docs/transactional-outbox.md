# Transactional Outbox

## Purpose

Payment state changes must not depend on an in-process event emitter or a second database write after the transaction. PayFlow uses an outbox table so the state change and its event record commit or roll back together.

## Current implementation

The Prisma schema includes `OutboxEvent` with:
- merchant ownership;
- event type and aggregate identity;
- JSON payload;
- unique merchant-scoped deduplication key;
- pending/processing/published/dead-letter states;
- attempt count, availability time, lock time, publication time, and last error.

PaymentAttempt persistence writes outbox records in the same transaction as:
- transition to processing and attempt creation;
- definitive success/failure result application;
- pending provider result;
- unknown provider outcome after timeout.

Event payloads contain normalized identifiers and status metadata only. Raw provider payloads and cardholder data are not copied into the outbox.

## Delivery semantics and remaining work

The outbox is currently a durable write model only. There is no dispatcher, lease/recovery worker, delivery retry loop, or webhook endpoint yet. Do not claim events are delivered.

The future dispatcher should:
1. Claim batches with PostgreSQL row locking (prefer `FOR UPDATE SKIP LOCKED`) and a short lease.
2. Commit the claim before network delivery.
3. Deliver outside the transaction.
4. Mark published only after the destination acknowledges.
5. Retry with exponential backoff and jitter; move exhausted events to dead-letter.
6. Recover expired PROCESSING leases after worker crashes.
7. Use the event ID as the downstream idempotency key.

Delivery is at-least-once. Consumers must deduplicate. Never promise exactly-once delivery.
