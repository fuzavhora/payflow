# Webhook Endpoint Management

## API

All routes require a merchant API key:
- `webhooks:write`: create, update, disable endpoints and replay failed deliveries.
- `webhooks:read`: list endpoints and inspect deliveries.

- `POST /api/v1/webhook-endpoints` — register URL and event types.
- `GET /api/v1/webhook-endpoints` — list current merchant endpoints.
- `PATCH /api/v1/webhook-endpoints/:id` — update URL, enabled state, or event subscriptions.
- `DELETE /api/v1/webhook-endpoints/:id` — disable endpoint.
- `GET /api/v1/webhook-deliveries` — list merchant delivery records.
- `GET /api/v1/webhook-deliveries/:id` — retrieve a delivery and its attempt history.
- `POST /api/v1/webhook-deliveries/:id/replay` — requeue a FAILED or DEAD_LETTER delivery if its endpoint is enabled.

Replay preserves lifetime attempt history and resets only the retry-cycle counter. Concurrent replay requests are safe: only the first can transition a terminal delivery back to PENDING. SUCCEEDED, PROCESSING, and PENDING deliveries cannot be replayed. Replay does not guarantee that the remote endpoint did not previously receive the event; consumers must deduplicate by event ID.

## Secret storage

A random 256-bit secret is generated per endpoint and encrypted using AES-256-GCM. Configure `PAYFLOW_WEBHOOK_ENCRYPTION_KEY` as exactly 64 hex characters. Keep it in a secret manager. The key version field is reserved for a future encryption-key migration.

## URL safety

Only HTTPS URLs with public-looking hostnames are accepted at registration. At delivery time the worker resolves all A/AAAA records, rejects any non-public answer, pins the selected validated address, verifies TLS, does not follow redirects, bounds request time, and caps response-body consumption. Add deployment-level egress controls and review address policy against current IANA special-purpose registries before production.

## Event format and signatures

The worker sends a deterministic JSON envelope containing `id`, `type`, `created`, and `data`. The exact raw body bytes are signed using HMAC-SHA256 over `timestamp + "." + rawBody`.

Headers:
- `PayFlow-Signature: t=<unix-seconds>,v1=<hex-digest>`
- `PayFlow-Event-Id`: stable outbox event ID for consumer deduplication.
- `PayFlow-Delivery-Id`: endpoint-specific delivery ID.

Delivery is at least once, not exactly once. A worker crash after remote acceptance but before local acknowledgement can cause duplicates.

## Worker runtime

The API process does not start background work. Configure `PAYFLOW_WEBHOOK_ENCRYPTION_KEY`, build, and run:
```bash
pnpm --filter @payflow/api build
pnpm --filter @payflow/api worker:webhooks
```

`WEBHOOK_WORKER_POLL_INTERVAL_MS` defaults to 1000 ms (250–60000). Worker defaults: batch 25, 60-second lease, 8 attempts per retry cycle, 8-second HTTPS timeout, exponential backoff with jitter. Run one or more replicas; PostgreSQL row locks and lock tokens coordinate claims.

## Delivery states

- `PENDING`: awaiting initial delivery or retry.
- `PROCESSING`: claimed by a worker.
- `SUCCEEDED`: endpoint returned 2xx.
- `FAILED`: permanent 3xx/4xx response (except 408, 409, 425, 429) or disabled endpoint.
- `DEAD_LETTER`: transient/network failure exhausted the retry-cycle limit.

Attempt records are retained across manual replay. Manual replay is not implemented for successful deliveries. Secret rotation API, delivery metrics, alerting, admin dead-letter tooling, provider integration and real money movement remain out of scope.
