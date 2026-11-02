# PayFlow — Architecture Baseline

**Status:** Proposed baseline  
**Last updated:** 2026-11-02

## 1. Scope and system boundary

PayFlow is a self-hostable payment application and orchestration layer. It coordinates payment operations across external payment providers and exposes a consistent API and dashboard.

PayFlow will not initially:
- Hold customer funds or operate as a bank/acquirer.
- Store raw card numbers (PAN), CVV, PIN, or track data.
- Implement card-network connectivity or settlement rails.
- Claim regulatory authorization or PCI DSS compliance.

Provider licensing, merchant onboarding, payment-method availability, regional regulations, and PCI scope remain the responsibility of the relevant provider and deploying merchant, subject to professional compliance review.

## 2. Logical components

1. **Web application** — public product pages, merchant dashboard, and developer workspace.
2. **API application** — authentication, merchant configuration, payment commands, queries, and webhook management.
3. **Domain modules** — merchants, customers, payment intents, payment attempts, refunds, subscriptions, invoices, and events.
4. **Provider adapters** — provider-specific request/response mapping behind a stable internal interface.
5. **Persistence** — PostgreSQL as the source of truth.
6. **Background workers** — durable webhook delivery, retries, reconciliation jobs, and asynchronous workflows.
7. **Observability** — structured logs, metrics, traces, audit events, and operational health.

## 3. Initial architecture decision

Start with a **modular monolith**, not microservices.

The payment lifecycle, database transactions, idempotency records, and audit trail need strong consistency boundaries. Splitting these into services before domain boundaries and operational requirements are proven would add distributed failure modes without delivering meaningful early value.

Modules should have explicit ownership and interfaces so extraction remains possible if measured scale or team boundaries justify it.

## 4. Payment lifecycle

The initial domain model should distinguish:

- **PaymentIntent** — the merchant's request to collect a defined amount and currency.
- **PaymentAttempt** — one attempt to execute the intent through a provider.
- **ProviderReference** — provider-side identifiers and status references.
- **Refund** — a separately tracked reversal request and its lifecycle.
- **WebhookEvent** — immutable event envelope and delivery state.
- **IdempotencyRecord** — scoped request key, request fingerprint, and stored outcome.

Do not collapse intent and attempt into one record. One intent may have multiple attempts, while each attempt belongs to exactly one provider execution.

Payment states must be explicit and transition-validated. Provider callbacks can be duplicated, delayed, or arrive out of order; state transitions must be monotonic where the domain permits and reconciled against provider truth when ambiguous.

## 5. Reliability requirements

- Require idempotency keys for mutating payment commands.
- Enforce uniqueness at the database layer for merchant-scoped idempotency keys.
- Persist domain changes and outbox events in one database transaction.
- Deliver webhooks asynchronously with bounded exponential backoff and jitter.
- Sign outbound webhooks and include event IDs and timestamps.
- Assume at-least-once delivery; never promise exactly-once delivery.
- Record provider request identifiers and sanitized error metadata.
- Implement reconciliation for operations whose final state cannot be confirmed synchronously.

## 6. Provider adapter contract

Provider-specific code must not leak into domain modules. A provider adapter should expose normalized capabilities such as:

- Create/confirm payment attempt.
- Retrieve payment status.
- Initiate refund.
- Verify inbound provider notification.
- Report supported currencies, payment methods, and regions.

Capabilities must be explicit. Do not assume all providers support identical authorization, capture, partial refund, recurring, or asynchronous payment semantics.

## 7. Security baseline

- Keep cardholder data out of PayFlow by using provider-hosted checkout or tokenization.
- Store secrets using a dedicated secret-management mechanism in deployed environments.
- Hash API secrets at rest; show secret material only at creation time.
- Scope credentials to a merchant and environment (test/live).
- Enforce tenant isolation in every query and mutation.
- Use role-based access control and immutable audit records for privileged actions.
- Verify webhook signatures and protect against replay.
- Apply rate limits and abuse controls to authentication and public endpoints.
- Redact secrets, tokens, and payment data from logs.

## 8. Data and consistency

PostgreSQL is the authoritative store. Redis is an acceleration and job-queue component, not the source of truth for payment state.

Financial records should be append-oriented and auditable. Before production use, design a proper double-entry ledger with immutable postings, balanced entries, currency-aware amounts, and correction entries rather than editing historical balances.

All monetary values must use integer minor units plus an ISO currency code. Never use floating-point arithmetic for money.

## 9. Deployment topology

Initial deployment target:

- Next.js web application.
- NestJS API application.
- PostgreSQL database.
- Redis for queues and short-lived coordination.
- Separate worker process using the same domain codebase.
- Reverse proxy / TLS termination.
- Centralized logs, metrics, backups, and alerting.

Local development should use Docker Compose. Production deployment guidance must include backup/restore testing, key rotation, migrations, and operational runbooks.

## 10. Open decisions

- License: MIT vs Apache-2.0.
- First payment-provider adapter and target geography.
- Merchant onboarding and tenant model.
- Authentication strategy and organization membership model.
- Ledger scope for the first public milestone.
- Deployment and secrets-management reference implementation.
