# PayFlow

An open-source, developer-first payment platform for payments, billing, subscriptions, and payment orchestration.

> **Project status:** Early development. PayFlow is an application and orchestration layer, not a bank, acquirer, card network, or licensed payment processor. Current PaymentIntent endpoints create local records only; they do not execute payments or move money.

## What exists today

- Next.js dashboard foundation with clearly fictional sample data.
- NestJS API with merchant API-key authentication and scope enforcement.
- Merchant-scoped customer APIs.
- Local PaymentIntent create/list/retrieve APIs with idempotency.
- PaymentIntent domain state machine and concurrency-safe internal transitions.
- PaymentAttempt persistence lifecycle.
- Transactional outbox writes for payment lifecycle events.
- PostgreSQL, Redis, Docker Compose, and GitHub Actions CI foundation.

## Quick start

See [Getting Started](docs/getting-started.md) for prerequisites, local database setup, Prisma migration, test merchant seeding, and application startup.

## Documentation

- [Getting Started](docs/getting-started.md)
- [API Reference](docs/api-reference.md)
- [Architecture](docs/architecture.md)
- [Payment Lifecycle](docs/payment-lifecycle.md)
- [Transactional Outbox](docs/transactional-outbox.md)
- [Security](docs/security.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Roadmap](docs/roadmap.md)
- [Contributing](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)

## Important security boundary

Never send raw card numbers, CVV, PIN, or magnetic-stripe track data to PayFlow. Future integrations should use provider-hosted checkout or provider tokenization. Do not use live credentials or real payment traffic with the current foundation.

## Development branch

Current implementation work is on `feat/payflow-foundation`. The `main` branch is not being updated as part of this work.

## License

No open-source license has been selected yet. Until a license is added, the repository is not granted an open-source reuse license.
