# Webhook Endpoint Management

## API

All routes require a merchant API key:
- `webhooks:write`: create, update, disable endpoints, rotate signing secrets and replay failed deliveries.
- `webhooks:read`: list endpoints and inspect deliveries.

- `POST /api/v1/webhook-endpoints` — register URL and event types.
- `GET /api/v1/webhook-endpoints` — list endpoints.
- `PATCH /api/v1/webhook-endpoints/:id` — update URL, enabled state or subscriptions.
- `POST /api/v1/webhook-endpoints/:id/rotate-secret` — rotate the signing secret.
- `DELETE /api/v1/webhook-endpoints/:id` — disable endpoint.
- `GET /api/v1/webhook-deliveries` — list deliveries.
- `GET /api/v1/webhook-deliveries/:id` — inspect delivery and attempts.
- `POST /api/v1/webhook-deliveries/:id/replay` — replay FAILED or DEAD_LETTER delivery if endpoint is enabled.

## Signing secret rotation

Rotation returns the new plaintext secret exactly once. Outbound requests use the new secret immediately. The previous encrypted secret is retained until the returned `previousSecretExpiresAt` timestamp so the receiving system can accept both signatures during the transition. The default grace period is 24 hours; the service currently uses this default, bounded to 60 seconds–7 days at the service boundary.

Update the receiver to accept both the old and new signing secrets during the grace period, then remove the old secret after expiry. A second rotation is rejected while a previous secret is still within its grace period; this prevents silently discarding a still-valid prior key. The server does not expose plaintext previous secrets. The grace period is for receiver-side verification compatibility, not for signing outbound messages with both keys.

This is signing-secret rotation only. Encryption-key rotation for `PAYFLOW_WEBHOOK_ENCRYPTION_KEY` remains a separate key-management operation and is not implemented.

## Secret storage

A random 256-bit signing secret is encrypted at rest using AES-256-GCM. Configure `PAYFLOW_WEBHOOK_ENCRYPTION_KEY` as exactly 64 hex characters and keep it in a secret manager. Plaintext secrets are never returned by list/update endpoints.

## URL safety and transport

Only HTTPS URLs with public-looking hostnames are accepted at registration. At delivery time the worker resolves all A/AAAA records with a 3-second resolution wait limit, rejects any non-public answer, pins the selected validated address, verifies TLS, does not follow redirects, bounds request time and caps response-body consumption. The underlying operating-system DNS lookup may continue in the background after the wait limit; no HTTPS request is made when the bounded wait expires. Add deployment-level egress controls and review address policy against current IANA special-purpose registries before production.

## Event format and signatures

The worker sends a deterministic JSON envelope containing `id`, `type`, `created`, and `data`. The exact raw body bytes are signed using HMAC-SHA256 over `timestamp + "." + rawBody`.

Headers:
- `PayFlow-Signature: t=<unix-seconds>,v1=<hex-digest>`
- `PayFlow-Event-Id`: stable outbox event ID for consumer deduplication.
- `PayFlow-Delivery-Id`: endpoint-specific delivery ID.

Delivery is at least once, not exactly once. A worker crash after remote acceptance but before local acknowledgement can cause duplicates. Consumers must deduplicate by event ID.

## Worker runtime

The API process does not start background work. Configure `PAYFLOW_WEBHOOK_ENCRYPTION_KEY`, build and run:
```bash
pnpm --filter @payflow/api build
pnpm --filter @payflow/api worker:webhooks
```

`WEBHOOK_WORKER_POLL_INTERVAL_MS` defaults to 1000 ms (250–60000). SIGINT/SIGTERM stops new polling immediately, interrupts the idle poll delay, and lets the active `runOnce` iteration drain its in-flight delivery wave before the Nest application context closes. If a delivery's remote request succeeds but its database acknowledgement fails, the worker logs the failure and leaves the lease for expiry/recovery; the remote endpoint may receive a duplicate, so consumers must deduplicate by event ID. Worker defaults: batch 25, concurrency 10, 60-second lease, 8 attempts per retry cycle, 8-second HTTPS timeout, exponential backoff with jitter. Claimed deliveries are processed in bounded concurrent waves so a large batch does not expire its leases while waiting in a sequential queue. The worker rejects configurations whose lease is shorter than the number of processing waves multiplied by the request timeout, plus a 15-second margin. Increase the lease when increasing timeout or reducing concurrency. Run one or more replicas; PostgreSQL row locks and lock tokens coordinate claims.

## Delivery states

- `PENDING`: awaiting initial delivery or retry.
- `PROCESSING`: claimed by a worker.
- `SUCCEEDED`: endpoint returned 2xx.
- `FAILED`: permanent 3xx/4xx response (except 408, 409, 425, 429) or disabled endpoint.
- `DEAD_LETTER`: transient/network failure exhausted the retry-cycle limit.

Attempt records are retained across manual replay. Successful deliveries cannot be replayed. Metrics, alerting, admin dead-letter tooling, encryption-key rotation, payment-provider integration and real money movement remain unimplemented.
