# Webhook Endpoint Management

## API

All routes require a merchant API key. Required scopes:
- `webhooks:write`: create, update, disable endpoints.
- `webhooks:read`: list endpoints.

- `POST /api/v1/webhook-endpoints` — register URL and event types.
- `GET /api/v1/webhook-endpoints` — list current merchant endpoints.
- `PATCH /api/v1/webhook-endpoints/:id` — update URL, enabled state, or event subscriptions.
- `DELETE /api/v1/webhook-endpoints/:id` — disable endpoint (soft disable).

Every database operation is scoped by authenticated merchant ID. The API never accepts merchant ID from the request body. Plaintext signing secret is returned only once at creation; list/update responses never expose encrypted or plaintext secret material.

## Secret storage

A random 256-bit secret is generated per endpoint. It is encrypted at rest using AES-256-GCM with a random 96-bit IV and authentication tag. Configure `PAYFLOW_WEBHOOK_ENCRYPTION_KEY` as exactly 64 hex characters (32 bytes). Keep this key in a secret manager, not source control. The schema records a key version to support a future rotation procedure.

## URL safety

Only HTTPS URLs with public-looking hostnames are accepted; literal IP addresses, localhost and local/internal suffixes are rejected. This is only an input-validation baseline. Before enabling outbound delivery, the delivery transport must resolve DNS at connection time, reject loopback/private/link-local/reserved IPv4 and IPv6 addresses, pin the validated address for the request, and revalidate every redirect (prefer disabling redirects). Otherwise DNS rebinding or redirects can turn webhook delivery into an SSRF primitive.

## Not yet implemented

Endpoint CRUD and secret encryption are implemented, but the outbox dispatcher is not yet connected to endpoints. HMAC request signing, timestamp/replay verification guidance, HTTP delivery, per-endpoint attempt history, timeout policy, SSRF-hardened DNS transport, secret rotation and manual replay are pending. Do not tell integrators that webhooks are being delivered yet.
