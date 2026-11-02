# PayFlow

[![GitHub stars](https://img.shields.io/github/stars/fuzavhora/payflow?style=social)](https://github.com/fuzavhora/payflow/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/fuzavhora/payflow?style=social)](https://github.com/fuzavhora/payflow/network/members)
[![GitHub issues](https://img.shields.io/github/issues/fuzavhora/payflow)](https://github.com/fuzavhora/payflow/issues)

An open-source, developer-first payments and billing platform.

> Early development / demo stage. Dashboard metrics are fictional. API payment intents are local records only. No money is moved and no card data is collected.

## Current implementation
- Responsive Next.js dashboard with fictional sample metrics.
- NestJS API and database-backed health endpoint.
- Merchant-scoped API key authentication with test/live environment checks and route scopes.
- Customer create/list/retrieve API.
- PaymentIntent create/list/retrieve API.
- Merchant-scoped idempotency with request fingerprint checks.
- PostgreSQL schema for merchants, API keys, customers, payment intents, attempts, and idempotency.
- Docker Compose for local PostgreSQL and Redis. Redis is provisioned but not yet connected to a worker.

## Local development
Requirements: Node.js 20+, pnpm 9+, Docker.

1. Copy env.example to .env.
2. Start infrastructure: docker compose up -d.
3. Install packages: pnpm install.
4. Generate Prisma client: pnpm db:generate.
5. Apply local migrations: pnpm db:migrate.
6. Create a local test merchant and API key:
   PAYFLOW_SEED_MERCHANT_NAME="Local Demo" PAYFLOW_SEED_MERCHANT_SLUG="local-demo" pnpm db:seed:merchant
7. Start apps: pnpm dev.

The seed command prints a test key once. Store it securely. It refuses production mode and refuses to recreate an existing slug.

Web: http://localhost:3000  
API health: http://localhost:4000/api/v1/health

## API examples

Create a customer:
curl -X POST http://localhost:4000/api/v1/customers -H "Authorization: Bearer YOUR_TEST_KEY" -H "Content-Type: application/json" -d '{"email":"customer@example.com","name":"Demo Customer"}'

Create a PaymentIntent (amount uses integer minor units; 1000 means 10.00 for a two-decimal currency):
curl -X POST http://localhost:4000/api/v1/payment-intents -H "Authorization: Bearer YOUR_TEST_KEY" -H "Idempotency-Key: order-12345" -H "Content-Type: application/json" -d '{"amount":1000,"currency":"USD","description":"Demo order"}'

List customers: GET /api/v1/customers?page=1&limit=20  
Retrieve customer: GET /api/v1/customers/{id}  
List PaymentIntents: GET /api/v1/payment-intents?page=1&limit=20  
Retrieve PaymentIntent: GET /api/v1/payment-intents/{id}

Every resource query is scoped to the merchant resolved from the API key. Customer and payment operations require explicit API key scopes.

## Product boundary
PayFlow is an application and orchestration layer, not a bank, acquirer, card network, or licensed payment processor. Never store raw PAN, CVV, PIN, or track data. Do not claim PCI DSS compliance without formal assessment.

No license has been selected yet. Until a license file is added, all rights are reserved by default.
