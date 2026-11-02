# PayFlow Roadmap

This roadmap is intentionally milestone-based. A feature is not complete because a screen exists; it is complete when its data model, API behavior, failure handling, tests, and documentation are covered.

## Milestone 0 — Foundation
- [x] Create public GitHub repository.
- [x] Establish protected development branch workflow by convention.
- [x] Document product boundary and architecture baseline.
- [ ] Select and add an open-source license.
- [ ] Add workspace manifests and application scaffolds.
- [ ] Add formatting, linting, type-checking, and test commands.
- [ ] Add CI checks and dependency/security scanning.
- [ ] Add contribution templates and code of conduct.

## Milestone 1 — Platform skeleton
- [ ] Next.js public site and authenticated dashboard shell.
- [ ] NestJS API health, configuration, and OpenAPI.
- [ ] PostgreSQL + Prisma schema and migration workflow.
- [ ] Redis + BullMQ worker process.
- [ ] Docker Compose for local development.
- [ ] Environment variable validation and safe example configuration.

## Milestone 2 — Merchant and developer foundation
- [ ] Merchant/organization model and tenant isolation.
- [ ] Authentication, sessions, and role-based access.
- [ ] Test/live environment separation.
- [ ] API key creation, hashing, rotation, and revocation.
- [ ] Audit log for security-sensitive operations.

## Milestone 3 — Payments core
- [ ] PaymentIntent and PaymentAttempt domain model.
- [ ] State machine and transition tests.
- [ ] Merchant-scoped idempotency.
- [ ] First provider adapter in sandbox/test mode.
- [ ] Refund lifecycle.
- [ ] Reconciliation and operational event history.

## Milestone 4 — Webhooks and billing
- [ ] Transactional outbox.
- [ ] Signed webhook delivery, retries, and replay tooling.
- [ ] Customers and saved provider tokens (never raw card data).
- [ ] Products, prices, subscriptions, and invoices.
- [ ] Subscription lifecycle and billing retry policies.

## Milestone 5 — Public developer experience
- [ ] API reference and integration guides.
- [ ] SDK and typed contracts.
- [ ] Local sandbox and webhook inspector.
- [ ] Example integrations.
- [ ] Self-hosting and upgrade documentation.

## Release gates

A release that handles real payment traffic must not be declared production-ready until security review, provider certification/approval where applicable, regulatory review for target markets, threat modeling, backup/restore drills, load testing, incident runbooks, and an appropriate PCI scope assessment are complete.
