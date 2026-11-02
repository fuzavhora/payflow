# PayFlow Roadmap

This roadmap reflects the current `feat/payflow-foundation` branch. A checked item means code or documentation exists; it does not imply production readiness.

## Foundation
- [x] Public repository and architecture baseline.
- [x] Monorepo structure and feature branch.
- [x] Responsive dashboard with fictional sample data.
- [x] NestJS API bootstrap and database-backed health endpoint.
- [x] PostgreSQL schema baseline and local infrastructure.
- [x] GitHub Actions build, typecheck, and test workflow passes on the current documentation/code-fix commit.
- [ ] Commit a reproducible pnpm lockfile.

## Merchant and developer platform
- [x] Merchant-scoped API key authentication foundation.
- [x] Test/live key environment validation and route scope enforcement.
- [x] Local test merchant and API key generator.
- [x] Merchant-scoped customer create/list/retrieve API.
- [ ] Merchant dashboard authentication and role-based access.
- [ ] API key management UI, rotation, and revocation endpoints.
- [ ] Audit events and rate limiting.

## Payments core
- [x] Create, list, and retrieve PaymentIntents as local records.
- [x] Merchant-scoped idempotency and canonical request fingerprint checks.
- [x] Pure PaymentIntent transition policy and unit tests.
- [x] Provider-neutral adapter contract.
- [ ] Persisted payment transition service with optimistic concurrency.
- [ ] Provider adapter and first provider sandbox integration.
- [ ] Payment attempt orchestration, refunds, and reconciliation.

## Webhooks and billing
- [ ] Transactional outbox and signed webhook delivery.
- [ ] Retry and replay tooling.
- [ ] Products, prices, subscriptions, and invoices.

## Developer experience
- [x] Getting-started guide and local setup instructions.
- [x] Current API reference with examples and error semantics.
- [x] Security guide and payment-data boundaries.
- [x] Troubleshooting guide.
- [x] Payment lifecycle and provider integration guide.
- [ ] SDKs and language-specific integration examples.
- [ ] Local webhook inspector.
- [ ] Self-hosting and upgrade documentation.

## Production gate

Do not declare production readiness until security review, provider approval, regulatory review, threat modeling, backup/restore drills, load testing, incident runbooks, and PCI scope assessment are complete. Current PaymentIntent endpoints do not execute payments.
