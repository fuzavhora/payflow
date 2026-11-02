# Roadmap

## Foundation
- [x] Merchant-scoped API key authentication and scopes
- [x] Customer API and local PaymentIntent records
- [x] PaymentIntent state machine and persisted transitions
- [x] PaymentAttempt lifecycle with unknown-outcome handling
- [x] Transactional outbox write model
- [x] Generic outbox dispatcher primitive (claim, lease recovery, retry, dead-letter)
- [ ] Separate worker runtime, lease renewal, metrics and operational controls
- [ ] Webhook destinations, endpoint authorization, encrypted signing secrets and rotation
- [ ] Provider adapter implementation and reconciliation

## Reliability and release engineering
- [ ] Commit reproducible pnpm lockfile
- [ ] Commit baseline Prisma migration
- [ ] PostgreSQL integration tests for SKIP LOCKED concurrency and lease recovery
- [ ] Load and failure testing before production claims
- [ ] Select and approve an open-source license

## Product
- [ ] Replace dashboard sample data with authenticated API-backed views
- [ ] Merchant onboarding and API key management UI
- [ ] Event inspection and delivery history
