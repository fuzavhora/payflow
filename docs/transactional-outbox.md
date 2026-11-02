# Transactional Outbox

## Purpose

PayFlow writes payment state changes and their outbox records in the same PostgreSQL transaction. Payloads contain normalized identifiers and status metadata only; raw provider payloads and cardholder data must never be copied into the outbox.

## Dispatch and webhook fanout

The API process does not start background work. WebhookDeliveryWorkerService runs in a separate process and:
1. Claims due outbox rows and expired leases using PostgreSQL FOR UPDATE SKIP LOCKED.
2. Calls idempotent webhook fanout, creating one durable delivery row per enabled endpoint subscribed to the event.
3. Marks the outbox row PUBLISHED only after fanout commits.
4. Claims endpoint delivery rows using a separate lease and lock token.
5. Creates attempt history before network I/O, signs the deterministic event envelope and sends the exact body through the SSRF-aware HTTPS transport.
6. Persists success, permanent failure, retry scheduling or dead-letter state.

The dispatcher is generic and accepts a destination handler. The webhook worker supplies the fanout handler; future event sinks should use their own handlers.

## Concurrency and recovery

- FOR UPDATE SKIP LOCKED prevents workers claiming the same available row concurrently.
- Claims are committed before network I/O.
- Expired PROCESSING leases can be reclaimed after worker crashes.
- Lock tokens fence stale workers from acknowledging or rescheduling rows they no longer own.
- Attempt records are created transactionally with each delivery claim; incomplete attempts from expired leases are marked as lease-expired.
- Retry uses capped exponential backoff with jitter.
- Permanent HTTP 3xx/4xx responses (except 408, 409, 425, 429) become FAILED; transient failures retry and eventually become DEAD_LETTER.
- Manual replay is allowed only for FAILED or DEAD_LETTER deliveries whose endpoint is enabled. It preserves lifetime attempt history and starts a new retry cycle.

## Delivery semantics and limitations

Delivery is at least once, not exactly once. A worker may deliver successfully and crash before acknowledging the database row; a later worker can redeliver after lease expiry. Consumers must deduplicate using the stable outbox event ID supplied in PayFlow-Event-Id.

The default HTTPS timeout is 8 seconds and delivery lease is 60 seconds. DNS resolution and runtime pauses can still exceed expectations; leases are not heartbeated. Worker health metrics, alerting, admin dead-letter tooling and lease renewal are not implemented. No concrete payment provider, card processing or money movement is implemented.
