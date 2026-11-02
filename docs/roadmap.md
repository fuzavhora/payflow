# PayFlow Roadmap

## Foundation
- [x] Public repository and architecture baseline.
- [x] Monorepo structure and feature branch.
- [x] Responsive dashboard with fictional sample data.
- [x] NestJS API bootstrap and database-backed health endpoint.
- [x] PostgreSQL schema baseline and local infrastructure.
- [ ] Install dependencies and run build, lint, and test verification.
- [ ] CI workflow and license selection.

## Merchant and developer platform
- [x] Merchant-scoped API key authentication foundation.
- [x] Test/live key environment validation and route scope enforcement.
- [x] Local test merchant and API key generator.
- [x] Merchant-scoped customer create/list/retrieve API.
- [ ] Merchant dashboard authentication and role-based access.
- [ ] API key management UI, rotation, and revocation endpoints.
- [ ] Audit events and rate limiting.

## Payments core
- [x] Create, list, and retrieve PaymentIntents in local test mode.
- [x] Merchant-scoped idempotency and request fingerprint checks.
- [ ] Explicit, tested payment state transition service.
- [ ] Provider adapter interface and first provider sandbox integration.
- [ ] Refund lifecycle and reconciliation.

## Webhooks and billing
- [ ] Transactional outbox and signed webhook delivery.
- [ ] Retry and replay tooling.
- [ ] Products, prices, subscriptions, and invoices.

## Developer experience
- [ ] API reference, SDK, integration guides, and examples.
- [ ] Local sandbox and webhook inspector.
- [ ] Self-hosting and upgrade documentation.

Do not declare production readiness until security review, provider approval, regulatory review, threat modeling, backup/restore drills, load testing, incident runbooks, and PCI scope assessment are complete.
