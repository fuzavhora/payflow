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
- [ ] Merchant model, tenant isolation, authentication, and roles.
- [ ] Test/live environment separation.
- [ ] API key creation, hashing, rotation, and revocation.
- [ ] Audit records for privileged operations.

## Payments core
- [ ] PaymentIntent and PaymentAttempt state machine.
- [ ] Merchant-scoped idempotency.
- [ ] First provider adapter in sandbox mode.
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
