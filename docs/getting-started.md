# Getting Started

This guide is for developers running PayFlow locally. It does not describe a production deployment.

## 1. What you are running

The repository contains two applications:

| Component | Default address | Purpose |
| --- | --- | --- |
| Next.js web dashboard | http://localhost:3000 | Early dashboard UI with sample/fictional metrics |
| NestJS API | http://localhost:4000 | Versioned REST API under /api/v1 |
| PostgreSQL | localhost:5432 | Persistent application data |
| Redis | localhost:6379 | Provisioned for future asynchronous jobs; not currently used by the API |

Current API features are merchant API-key authentication, customer management, and local PaymentIntent records. Creating a PaymentIntent does **not** charge a card, contact a payment provider, authorize funds, or move money.

## 2. Prerequisites

- Node.js 20 or newer.
- pnpm 9 or newer.
- Docker Engine or Docker Desktop with Docker Compose.
- Git.

Verify versions:

```bash
node --version
pnpm --version
docker --version
docker compose version
```

## 3. Get the code and configure the environment

```bash
git clone https://github.com/fuzavhora/payflow.git
cd payflow
git switch feat/payflow-foundation
cp env.example .env
```

The branch above is the current development branch. Do not assume `main` contains these features.

Review `.env`. The supplied values are local-only defaults. Do not reuse the sample database password, expose services publicly, or commit a real `.env` file.

| Variable | Purpose | Local default |
| --- | --- | --- |
| NODE_ENV | Runtime mode | development |
| API_PORT | API listen port | 4000 |
| DATABASE_URL | PostgreSQL connection string | local payflow database |
| REDIS_URL | Future queue connection | redis://localhost:6379 |
| NEXT_PUBLIC_API_URL | API base URL exposed to browser code | http://localhost:4000/api/v1 |
| WEB_ORIGIN | Allowed browser origin(s), comma-separated | http://localhost:3000 |

## 4. Start infrastructure

```bash
docker compose up -d
docker compose ps
```

PostgreSQL and Redis should become healthy. To inspect logs:

```bash
docker compose logs -f postgres
docker compose logs -f redis
```

## 5. Install and initialize

From the repository root:

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
```

The migration script currently runs Prisma's development migration command with the name `init`. It may create a migration directory on first setup. Commit reviewed migration files when contributing schema changes.

## 6. Create a local test merchant

Run this from the repository root:

```bash
PAYFLOW_SEED_MERCHANT_NAME="Local Demo" \
PAYFLOW_SEED_MERCHANT_SLUG="local-demo" \
pnpm db:seed:merchant
```

The command creates a merchant and a test API key with these scopes:

- `customers:read`
- `customers:write`
- `payment_intents:read`
- `payment_intents:write`

Copy the key from the terminal immediately. The full secret is displayed only once; the database stores its SHA-256 hash. Keep it in a password manager or local secret store. Never commit it, put it in screenshots, or send it to a browser application.

The script refuses to run when `NODE_ENV=production` and refuses to create a duplicate merchant slug. To create another local key for testing, use a new slug. Key-management endpoints are not implemented yet.

## 7. Start the applications

```bash
pnpm dev
```

Or run each application in a separate terminal:

```bash
pnpm dev:api
pnpm dev:web
```

Check API health:

```bash
curl http://localhost:4000/api/v1/health
```

Open http://localhost:3000 for the dashboard. Dashboard values are demo data and are not read from a live payment processor.

## 8. Make your first API requests

Set the test key in your terminal (avoid placing the literal key in shell history when possible):

```bash
export PAYFLOW_TEST_KEY='pf_test_...'
```

Create a customer:

```bash
curl -i -X POST http://localhost:4000/api/v1/customers \
  -H "Authorization: Bearer $PAYFLOW_TEST_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"customer@example.com","name":"Demo Customer"}'
```

Create a PaymentIntent:

```bash
curl -i -X POST http://localhost:4000/api/v1/payment-intents \
  -H "Authorization: Bearer $PAYFLOW_TEST_KEY" \
  -H "Idempotency-Key: local-order-0001" \
  -H "Content-Type: application/json" \
  -d '{"amount":1000,"currency":"USD","description":"Local test order"}'
```

Here `1000` is an integer amount in minor currency units. For a two-decimal currency, that commonly represents 10.00. Do not send decimal floating-point amounts. Currency exponent rules vary; provider-specific currency validation is not implemented yet.

Use the returned ID to retrieve the resource. See [API Reference](api-reference.md) for all currently available routes and examples.

## 9. Run quality checks

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

The web test script currently reports that no web tests are configured. API tests exist, but CI must pass before treating the branch as verified. Check the [GitHub Actions workflow](https://github.com/fuzavhora/payflow/actions).

## 10. Stop local services

```bash
docker compose down
```

To delete local database and Redis data as well (destructive):

```bash
docker compose down -v
```

## Troubleshooting

See [Troubleshooting](troubleshooting.md). For security boundaries and handling keys, see [Security Guide](security.md).
