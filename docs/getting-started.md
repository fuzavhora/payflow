# Getting Started

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker Desktop or Docker Engine with Compose

## Install

```bash
git clone https://github.com/fuzavhora/payflow.git
cd payflow
git switch feat/payflow-foundation
pnpm install
cp env.example .env
```

## Start infrastructure

```bash
docker compose up -d postgres redis
```

Wait until PostgreSQL is healthy, then generate the Prisma client and create the local schema migration:

```bash
pnpm --filter @payflow/api prisma:generate
pnpm --filter @payflow/api exec prisma migrate dev --name init
```

The Prisma schema is the source of truth. Review generated migration SQL before applying it to shared environments. Do not use prisma db push as a substitute for reviewed migrations in shared environments.

## Configure webhook encryption

Generate a 32-byte key and add it to your local .env:

```bash
openssl rand -hex 32
```

Set the result as PAYFLOW_WEBHOOK_ENCRYPTION_KEY. Never commit this value. It is required by the webhook worker and webhook endpoint secret operations.

## Seed a test merchant

```bash
PAYFLOW_MERCHANT_NAME="Local Demo" PAYFLOW_MERCHANT_SLUG="local-demo" pnpm --filter @payflow/api seed:merchant
```

The generated test API key is printed once. Store it securely; only its hash is persisted. Never commit it or put it in browser-side code.

## Run the applications

```bash
pnpm --filter @payflow/api dev
pnpm --filter @payflow/web dev
```

API base URL: http://localhost:4000/api/v1  
Dashboard: http://localhost:3000

## Run the webhook worker

Run this in a separate process after the database migration has been applied and PAYFLOW_WEBHOOK_ENCRYPTION_KEY is configured:

```bash
pnpm --filter @payflow/api build
pnpm --filter @payflow/api worker:webhooks
```

The worker polls the transactional outbox, creates durable delivery records for subscribed endpoints, and sends signed HTTPS requests. Delivery is at least once. Consumers must verify the raw body signature and deduplicate using the event ID. See webhook-endpoints.md for endpoint APIs, replay, secret rotation and security behavior.

## Current functional scope

The API supports merchant API-key authentication, customer CRUD, local PaymentIntent create/list/retrieve operations, internal payment state/attempt services, transactional outbox dispatch and webhook delivery. No concrete payment provider is connected. A successful PaymentIntent API response is not a payment authorization or settlement. The dashboard currently uses fictional sample data.

## Stop and reset

```bash
docker compose down
```

To delete local database and Redis data (destructive):

```bash
docker compose down -v
```

## Troubleshooting

See troubleshooting.md, api-reference.md, security.md, payment-lifecycle.md and webhook-endpoints.md.
