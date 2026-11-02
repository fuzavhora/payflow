# PayFlow

An open-source, developer-first payment platform for payments, billing, subscriptions, and payment orchestration.

> **Project status:** Early development. PayFlow is an application and orchestration layer, not a bank, acquirer, card network, or licensed payment processor. PaymentIntent creation currently stores local records only; it does not authorize, capture, settle, or move money.

## What exists today

- Next.js dashboard foundation with clearly fictional sample data.
- NestJS API with merchant API-key authentication, test/live key metadata and scope enforcement.
- Merchant-scoped customer APIs.
- Local PaymentIntent create/list/retrieve APIs with merchant-scoped idempotency.
- PaymentIntent domain state machine and concurrency-safe internal transitions.
- PaymentAttempt persistence lifecycle, including unknown-outcome handling.
- Transactional outbox with lease-based dispatcher and retry/dead-letter handling.
- Merchant-scoped webhook endpoint CRUD and encrypted signing-secret storage.
- Separate webhook worker with durable fanout, DNS-pinned HTTPS transport, HMAC signatures, delivery history, retry/dead-letter handling, manual replay and signing-secret rotation with grace period.
- PostgreSQL, Redis, Docker Compose and GitHub Actions CI foundation.

Webhook delivery requires a running worker process and PAYFLOW_WEBHOOK_ENCRYPTION_KEY. Delivery is at least once; receiving systems must deduplicate by event ID. See docs/webhook-endpoints.md and docs/transactional-outbox.md.

## Quick start

See docs/getting-started.md for prerequisites, local database setup, Prisma migration, test merchant seeding, and application startup.

## Documentation

- Getting Started: docs/getting-started.md
- API Reference: docs/api-reference.md
- Architecture: docs/architecture.md
- Payment Lifecycle: docs/payment-lifecycle.md
- Webhook Endpoint Management: docs/webhook-endpoints.md
- Transactional Outbox: docs/transactional-outbox.md
- Security: docs/security.md
- Troubleshooting: docs/troubleshooting.md
- Roadmap: docs/roadmap.md
- Contributing: CONTRIBUTING.md
- Security Policy: SECURITY.md

## Important security boundary

Never send raw card numbers, CVV, PIN, or magnetic-stripe track data to PayFlow. Future integrations should use provider-hosted checkout or provider tokenization. Do not use live credentials or real payment traffic with the current foundation.

No PCI DSS compliance claim, production readiness claim, or completed third-party security assessment is made.

## Development branch

Current implementation work is on feat/payflow-foundation. The main branch is not being updated as part of this work.

## License

No open-source license has been selected yet. Until a license is added, the repository is not granted an open-source reuse license.
