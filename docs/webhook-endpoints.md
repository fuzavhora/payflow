# Webhook Endpoint Management

## API

All routes require a merchant API key. Required scopes:
- `webhooks:write`: create, update, disable endpoints.
- `webhooks:read`: list endpoints and inspect deliveries.

- `POST /api/v1/webhook-endpoints` — register URL and event types.
- `GET /api/v1/webhook-endpoints` — list current merchant endpoints.
- `PATCH /api/v1/webhook-endpoints/:id` — update URL, enabled state, or event subscriptions.
- `DELETE /api/v1/webhook-endpoints/:id` — disable endpoint (soft disable).
- `GET /api/v1/webhook-deliveries` — list merchant delivery records.
- `GET /api/v1/webhook-deliveries/:id` — retrieve one delivery and its attempt history.

Every database operation is scoped by authenticated merchant ID. The API never accepts merchant ID from the request body. Plaintext signing secret is returned only once at creation; list/update responses never expose encrypted or plaintext secret material.

## Secret storage

A random 256-bit secret is generated per endpoint. It is encrypted at rest using AES-256-GCM with a random 96-bit IV and authentication tag. Configure `PAYFLOW_WEBHOOK_ENCRYPTION_KEY` as exactly 64 hex characters (32 bytes). Keep this key in a secret manager, not source control. The schema records a key version to support a future rotation procedure.

## URL safety

Only HTTPS URLs with public-looking hostnames are accepted at registration. At delivery time the worker resolves all A/AAAA records, rejects the hostname if any answer is non-public, pins the selected validated address for the HTTPS request, verifies TLS certificates, does not follow redirects, bounds request time, and caps response-body consumption. This reduces DNS-rebinding and redirect-based SSRF exposure, but the network policy still requires review against current IANA special-purpose registries and deployment-specific egress controls before production.

## Signature and event format

The worker sends a deterministic JSON envelope:
```json
{
  "id": "outbox_event_id",
  "type": "payment_intent.succeeded",
  "created": "2026-11-02T00:00:00.000Z",
  "data": {}
}
```

The exact raw body bytes are signed using HMAC-SHA256 over `timestamp + "." + rawBody`. Headers:
- `PayFlow-Signature: t=<unix-seconds>,v1=<hex-digest>`
- `PayFlow-Event-Id`: stable outbox event ID; use this for consumer deduplication.
- `PayFlow-Delivery-Id`: endpoint-specific delivery record ID.

Consumers must verify the raw request body and signature, enforce a timestamp tolerance, and deduplicate by event ID. Delivery is at least once: a worker crash after the remote endpoint accepts a request but before local acknowledgement can cause a duplicate.

## Worker runtime

The API process does not start background work. Build the API, configure the database and `PAYFLOW_WEBHOOK_ENCRYPTION_KEY`, then run the separate worker process:
```bash
pnpm --filter @payflow/api build
pnpm --filter @payflow/api worker:webhooks
```

Optional environment variables:
- `WEBHOOK_WORKER_POLL_INTERVAL_MS` — polling delay, default 1000 ms, bounded 250–60000.
- Worker defaults: batch 25, 60-second lease, 8 attempts, 8-second HTTPS timeout, exponential retry with jitter capped at one hour.

Run one or more worker replicas. PostgreSQL `FOR UPDATE SKIP LOCKED` and per-row lease tokens coordinate concurrent claims. The request timeout is intentionally shorter than the default lease; unusually slow DNS or process pauses can still outlive a lease, so consumers must deduplicate.

## Delivery states

- `PENDING`: waiting for initial delivery or retry.
- `PROCESSING`: claimed by a worker with a lease.
- `SUCCEEDED`: endpoint returned 2xx.
- `FAILED`: permanent HTTP 3xx/4xx response (except 408, 409, 425, 429) or disabled endpoint.
- `DEAD_LETTER`: transient/network failure exhausted the attempt limit.

Each claimed attempt is persisted before network I/O and completed with response status, duration, or bounded error details. Expired in-progress attempts are marked as lease-expired before a new attempt is created. There is no manual replay endpoint, secret rotation API, delivery metrics/alerting, or admin dead-letter tooling yet.
