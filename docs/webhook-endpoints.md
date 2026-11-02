# Webhook Endpoint Management

## API

All routes require a merchant API key. Required scopes:
- `webhooks:write`: create, update, disable endpoints.
- `webhooks:read`: list endpoints.

- `POST /api/v1/webhook-endpoints` — register URL and event types.
- `GET /api/v1/webhook-endpoints` — list current merchant endpoints.
- `PATCH /api/v1/webhook-endpoints/:id` — update URL, enabled state, or event subscriptions.
- `DELETE /api/v1/webhook-endpoints/:id` — disable endpoint (soft disable).\n- `GET /api/v1/webhook-deliveries` — list merchant delivery records.\n- `GET /api/v1/webhook-deliveries/:id` — retrieve one delivery and its attempt history.

Every database operation is scoped by authenticated merchant ID. The API never accepts merchant ID from the request body. Plaintext signing secret is returned only once at creation; list/update responses never expose encrypted or plaintext secret material.

## Secret storage

A random 256-bit secret is generated per endpoint. It is encrypted at rest using AES-256-GCM with a random 96-bit IV and authentication tag. Configure `PAYFLOW_WEBHOOK_ENCRYPTION_KEY` as exactly 64 hex characters (32 bytes). Keep this key in a secret manager, not source control. The schema records a key version to support a future rotation procedure.

## URL safety

Only HTTPS URLs with public-looking hostnames are accepted; literal IP addresses, localhost and local/internal suffixes are rejected. This is only an input-validation baseline. Before enabling outbound delivery, the delivery transport must resolve DNS at connection time, reject loopback/private/link-local/reserved IPv4 and IPv6 addresses, pin the validated address for the request, and revalidate every redirect (prefer disabling redirects). Otherwise DNS rebinding or redirects can turn webhook delivery into an SSRF primitive.

## Signature primitive

`WebhookSignatureService` signs the exact raw HTTP body bytes using HMAC-SHA256 over `timestamp + "." + rawBody` and emits `t=<unix-seconds>,v1=<hex-digest>`. Verification uses constant-time digest comparison and a default 300-second timestamp tolerance. Consumers must verify the raw request body, reject stale timestamps, and implement event-ID deduplication. `WebhookEndpointsService.getSecretForDelivery` decrypts an enabled endpoint secret for internal server-side delivery use only; never expose it through a controller or logs.

## Durable delivery fanout

`WebhookDeliveryService.fanout` materializes one database delivery row for every enabled endpoint subscribed to an outbox event. The unique `(endpointId, outboxEventId)` constraint plus `createMany(skipDuplicates)` makes fanout safe to retry. Delivery and attempt history are tenant-scoped when read. This stage persists work; it does not yet perform outbound HTTP requests.

## Outbound transport security primitive

`SecureWebhookHttpTransport` is a server-side HTTPS POST transport that resolves all A/AAAA records, rejects the host if any answer is non-public, pins the selected validated address for TLS HTTP connection, refuses redirects, enforces a bounded timeout, and caps response-body consumption. It currently exposes a transport primitive only; the delivery worker must call it and persist each result before webhook delivery is considered operational. Network policy should be reviewed and tested against the deployment environment and current IANA special-purpose registries before production use.

## Not yet implemented

Endpoint CRUD and secret encryption are implemented, but the outbox dispatcher is not yet connected to endpoints. HMAC request signing, timestamp/replay verification guidance, HTTP delivery, per-endpoint attempt history, timeout policy, SSRF-hardened DNS transport, secret rotation and manual replay are pending. Do not tell integrators that webhooks are being delivered yet.
