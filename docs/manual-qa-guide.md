# PayFlow Manual QA Guide

## Important test boundary

This guide tests the current development branch, not a production payment system. PaymentIntent creation persists a local database record only. It does not call a payment provider, authorize a card, capture funds, or move money. Do not enter real card details, real payment credentials, or live provider keys.

The dashboard currently contains fictional sample data. For reliable functional testing today, use the API through Postman. The dashboard should not be treated as proof that API persistence or payment processing works.

## 1. What you need

- Node.js 20+
- pnpm 9+
- Docker Desktop / Docker Engine
- Postman
- Git access to the PayFlow repository

Use branch: `feat/payflow-foundation`.

## 2. Start PayFlow locally

From the repository root:

```bash
git switch feat/payflow-foundation
pnpm install
cp env.example .env
docker compose up -d postgres redis
pnpm db:generate
```

Apply the Prisma schema to your local development database using the documented migration workflow. If no committed migration baseline exists yet, the current local-only fallback is:

```pnpm --filter @payflow/api prisma:test:reset```

**Warning:** that command uses `prisma db push --accept-data-loss`. It is destructive to the target schema. Only use it against a disposable local database, never production or a shared environment.

Configure webhook encryption in `.env`:

```bash
openssl rand -hex 32
```

Set the output as `PAYFLOW_WEBHOOK_ENCRYPTION_KEY` (64 hex characters). Keep it private and do not commit it.

Create a test merchant and API key:

```bash
PAYFLOW_MERCHANT_NAME="Manual QA Merchant" PAYFLOW_MERCHANT_SLUG="manual-qa" pnpm --filter @payflow/api seed:merchant
```

The test key is printed once. Copy it immediately into the local Postman environment. Never paste it into screenshots, issues, chat, or source control.

Start the API in terminal 1:

```bash
pnpm --filter @payflow/api dev
```

Verify:

```bash
curl http://localhost:4000/api/v1/health
```

Expected: HTTP 200 and `status: "ok"`.

## 3. Import Postman files

Import these two files from this repository:

- `postman/PayFlow-Local-QA.postman_collection.json`
- `postman/PayFlow-Local.postman_environment.json`

In Postman:
1. Select the **PayFlow Local** environment.
2. Set `apiKey` to the test key printed by the seed command.
3. Set `baseUrl` to `http://localhost:4000/api/v1`.
4. Save the environment.
5. Run requests in folder order. The collection automatically saves customer and PaymentIntent IDs after successful creation.

## 4. Manual test scenarios and expected results

### A. Health and API authentication

| Test | Action | Expected |
|---|---|---|
| A1 | GET `/health` | 200; database reports ok |
| A2 | GET `/customers` without Authorization | 401 |
| A3 | GET `/customers` with valid test key | 200 |
| A4 | Use a key without `customers:write` for POST customer | 403 |
| A5 | Use an invalid/revoked/expired key | 401 |

For A4, create a second restricted key only if the seed/admin workflow supports scope selection; otherwise the automated integration suite covers this case.

### B. Customer lifecycle

1. Create a customer with email `  MANUAL.QA@example.com  `.
2. Confirm HTTP 201 and normalized email `manual.qa@example.com`.
3. List customers and confirm the record appears.
4. Retrieve the customer using the ID saved in the environment.
5. Create the same email again; expect HTTP 409.
6. Try an invalid email; expect HTTP 400.
7. Try an unknown JSON property; expect HTTP 400.

### C. PaymentIntent and idempotency

1. Create a PaymentIntent with amount `2599`, currency `USD`, and the created customer ID.
2. Confirm HTTP 201, amount string `"2599"`, and initial status `requires_payment_method`.
3. Repeat the exact request using the same `Idempotency-Key`; expect original record and `idempotentReplay: true`.
4. Change amount to `2600` but reuse the same key; expect HTTP 409.
5. Use a new idempotency key for a new operation; expect a new PaymentIntent record.
6. Retrieve and list PaymentIntents.

**Do not expect a card form, provider redirect, authorization, capture, or successful payment status. Those capabilities are not integrated.**

### D. Webhook endpoint management

A webhook endpoint must use a publicly reachable HTTPS URL. For a manual receiver, create a temporary HTTPS request-bin endpoint using a service you trust (for example, webhook.site) and paste its HTTPS URL into `webhookReceiverUrl`.

1. Create an endpoint subscribed to `payment_intent.succeeded` and `payment_intent.failed`.
2. Save the returned `whsec_...` secret in a secure local password manager. It is shown once.
3. List endpoints. Confirm secret ciphertext, IV, auth tag, and plaintext secret are not returned.
4. Disable the endpoint, then re-enable it.
5. Rotate the signing secret and securely save the new secret.
6. Confirm the old secret is retained only for the documented grace period; outbound deliveries use the new secret.

**Current limitation:** public API calls do not yet trigger a complete provider-backed payment attempt lifecycle. Creating a PaymentIntent alone will not produce a succeeded/failed webhook. Endpoint configuration can be manually tested; end-to-end event delivery is covered by worker-level tests and remains a separate integration milestone.

### E. Webhook delivery operations

1. List deliveries.
2. If a delivery exists, retrieve it and inspect status and attempt history.
3. Replay only a FAILED or DEAD_LETTER delivery whose endpoint is enabled.
4. Confirm replay is rejected for PENDING/PROCESSING/SUCCEEDED deliveries.
5. Confirm replay does not reset lifetime attempt count.

If no delivery is listed, that is expected when no internal outbox event has been created and fanned out. Do not fabricate a delivery ID.

## 5. Run automated tests

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @payflow/api prisma:test:reset
pnpm --filter @payflow/api test:integration
pnpm build
```

The database reset command is destructive to the configured test schema. Use a dedicated disposable database.

## 6. Run the webhook worker

After the API is built and the encryption key is configured, start the worker in a separate terminal:

```bash
pnpm --filter @payflow/api build
pnpm --filter @payflow/api worker:webhooks
```

The worker polls the transactional outbox and delivery queue. With no eligible outbox events/deliveries it may remain idle. It is not a payment simulator and does not invent payment events.

## 7. Record results

For each test, record:
- Scenario ID (A1, B1, C1, etc.).
- Pass / Fail / Blocked.
- HTTP status.
- Sanitized response body (remove API keys, webhook secrets, tokens and personal data).
- Expected vs actual behavior.
- Commit SHA and branch.
- Timestamp and environment (local Docker / CI).

Do not share API keys, webhook signing secrets, encryption keys, database credentials, or real customer/payment data in test evidence.

## 8. Known limitations before production-like testing

- No real payment provider adapter or payment execution.
- No committed/reviewed Prisma migration baseline yet.
- PostgreSQL concurrency and lock-fencing tests remain to be added.
- End-to-end webhook delivery with an actual TLS receiver and running worker remains pending.
- Dashboard values are sample data, not live backend telemetry.
- No PCI DSS compliance or production-readiness claim is made.

A successful manual smoke test validates only the tested path. It does not certify payment compliance, security, resilience under load, or production readiness.
