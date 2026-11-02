# Roadmap

## Foundation

- [x] Merchant-scoped API key authentication and scopes
- [x] Customer API and local PaymentIntent records
- [x] PaymentIntent state machine and persisted transitions
- [x] PaymentAttempt lifecycle with unknown-outcome handling
- [x] Transactional outbox write model and generic dispatcher
- [x] Separate webhook worker runtime and durable endpoint fanout
- [x] SSRF-aware HTTPS transport with DNS screening and IP pinning
- [x] HMAC-signed webhook event delivery and attempt history
- [x] Retry, dead-letter, lease recovery and stale-worker fencing
- [x] Merchant-scoped delivery inspection and manual replay
- [x] Encrypted webhook signing-secret storage and grace-period rotation
- [ ] Lease heartbeat and graceful worker drain
- [ ] Worker metrics, health checks, alerting and operational dashboards
- [ ] Concrete provider adapter and provider reconciliation

## Reliability and release engineering

- [ ] Commit reproducible pnpm lockfile and enable frozen-lockfile CI
- [ ] Commit reviewed Prisma migration baseline
- [ ] PostgreSQL integration tests for SKIP LOCKED concurrency and lease recovery
- [ ] Real HTTPS receiver integration tests in an isolated test environment
- [ ] Load, chaos and failure testing before production claims
- [ ] Review SSRF address policy against IANA special-purpose registries
- [ ] External security review and penetration testing
- [ ] Select and approve an open-source license

## Product

- [ ] Replace dashboard sample data with authenticated API-backed views
- [ ] Merchant onboarding and API key management UI
- [ ] Event inspection and delivery history UI
- [ ] Provider setup, payment methods and checkout orchestration
