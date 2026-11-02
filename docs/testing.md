# PayFlow Testing Strategy

## Validation layers

| Layer | Coverage | Command |
| --- | --- | --- |
| Static validation | TypeScript compilation and builds | `pnpm typecheck`, `pnpm build` |
| Unit tests | Domain state machine, guards, services, outbox, webhook signing/transport/worker | `pnpm test` |
| API integration | Real NestJS HTTP boundary, PostgreSQL persistence, API-key auth/scopes, tenant isolation, DTO validation, customer uniqueness and PaymentIntent idempotency | `pnpm --filter @payflow/api test:integration` |
| Operational tests | Worker restart/recovery, TLS receiver, failure injection and load | Scenarios below |

## Local PostgreSQL integration setup

1. Start PostgreSQL: `docker compose up -d postgres`.
2. Install dependencies and generate Prisma client: `pnpm install && pnpm db:generate`.
3. Use a dedicated disposable test database (never development or production data):

   ```bash
   export DATABASE_URL="postgresql://payflow:payflow_local@localhost:5432/payflow_test?schema=public"
   ```

4. Create the test schema and run the real HTTP integration suite:

   ```bash
   pnpm --filter @payflow/api prisma:test:reset
   pnpm --filter @payflow/api test:integration
   ```

   The reset command runs Prisma `db push --accept-data-loss`; only point it at a disposable test database.

5. Run all local checks: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

## Current integration coverage

- Live database health endpoint.
- Missing/malformed API keys and scope enforcement.
- Customer email normalization and per-merchant uniqueness.
- Tenant isolation for customer retrieval and listing.
- PaymentIntent creation and integer minor-unit string serialization.
- Idempotency replay with canonical nested metadata key ordering.
- Idempotency conflict when the same key is reused with a changed request.
- Tenant isolation for PaymentIntent retrieval.
- DTO validation and required idempotency key behavior.

The suite starts the actual NestJS application on an ephemeral local port and creates isolated merchant/API-key fixtures. Fixtures are removed after execution.

## Webhook worker failure-injection checklist

Use only a local database and a controlled HTTPS receiver:

1. Return 2xx and verify successful delivery and attempt history.
2. Return 500 repeatedly; verify retry schedule and eventual dead-letter state.
3. Return 400; verify permanent failure without retry.
4. Return 429/408/409/425; verify transient retry.
5. Terminate worker after claim; verify lease expiry permits recovery.
6. Run two workers concurrently; verify a delivery is not claimed twice concurrently.
7. Replay a failed delivery; verify lifetime attempts remain monotonic and attempts-in-cycle resets.
8. Simulate receiver acceptance followed by worker termination before DB acknowledgement; verify receiver deduplication by stable event ID.
9. Resolve a webhook hostname to mixed public/private addresses; verify rejection before connection.
10. Rotate signing secrets and verify the receiver's grace-period overlap.

## Remaining verification gaps

- Committed/reviewed Prisma migration baseline and CI `migrate deploy` validation. CI currently uses `db push` against a fresh ephemeral database; this does not validate migration history.
- Real PostgreSQL concurrency tests for `FOR UPDATE SKIP LOCKED`, lock-token fencing, stale lease recovery and concurrent idempotency requests.
- End-to-end webhook tests using a controlled TLS receiver and an actual worker process.
- Load/soak tests for API throughput, worker throughput, pool saturation and retry storms.
- Dependency/container/secret scanning and independent security review.
- Provider contract tests after provider and target region are selected.

Passing CI is not PCI DSS compliance or production-readiness evidence. PaymentIntent creation still persists local records only; no provider authorizes/captures funds.
