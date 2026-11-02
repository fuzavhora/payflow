# Transactional Outbox

## Purpose

PayFlow writes payment state changes and their outbox records in the same PostgreSQL transaction. Payloads contain normalized identifiers and status metadata only; raw provider payloads and cardholder data must never be copied into the outbox.

## Dispatcher

`OutboxDispatcherService.dispatchOnce(handler, options)` is a generic delivery primitive exported by the payments module. It is deliberately not started by the API process; a separately managed worker runtime must invoke it with a destination-specific handler.

- Claims due PENDING rows and expired PROCESSING leases in one short transaction.
- Uses PostgreSQL `FOR UPDATE SKIP LOCKED` so concurrent workers claim disjoint rows.
- Increments attempts and stamps the lease before committing.
- Performs destination/network I/O after the claim transaction commits.
- Marks PUBLISHED only after the handler resolves successfully.
- Applies capped exponential equal-jitter backoff on failure and DEAD_LETTER after the configured attempt limit.
- Reclaims PROCESSING rows whose lease expired after a worker crash.

Defaults: batch 25, lease 60 seconds, max 8 attempts, retry base 1 second, retry cap 1 hour. Options are validated and bounded.

## Delivery semantics and limitations

Delivery is **at least once**, not exactly once. A worker may deliver successfully and crash before marking PUBLISHED; a later worker can redeliver after lease expiry. Destination handlers must use `message.id` as their downstream idempotency key.

Keep handler execution comfortably below the lease duration. Each claim batch receives a fresh ownership token. A stale worker cannot acknowledge or reschedule an event after another worker has reclaimed it. Lease heartbeat is not implemented; long-running handlers can still overlap after lease expiry, but only the current token owner can mutate the row. The current code is a dispatcher primitive, not a worker process or scheduler.

Dead-letter events require an explicit operational replay/requeue procedure. No webhook endpoint/subscription model, signing secret storage/rotation, delivery history, metrics, alerting, or dead-letter UI exists yet. No concrete payment provider or money movement is implemented.
