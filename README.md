# PayFlow

[![CI](https://github.com/fuzavhora/payflow/actions/workflows/ci.yml/badge.svg?branch=feat/payflow-foundation)](https://github.com/fuzavhora/payflow/actions/workflows/ci.yml)
[![GitHub stars](https://img.shields.io/github/stars/fuzavhora/payflow?style=social)](https://github.com/fuzavhora/payflow/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/fuzavhora/payflow?style=social)](https://github.com/fuzavhora/payflow/network/members)
[![GitHub issues](https://img.shields.io/github/issues/fuzavhora/payflow)](https://github.com/fuzavhora/payflow/issues)

An open-source, developer-first payments and billing platform.

> **Early development / demo stage.** Dashboard metrics are fictional. PaymentIntent endpoints currently create local database records only. No money is moved, no payment provider is contacted, and no card data is collected.

## Documentation

- [Getting Started](docs/getting-started.md) — prerequisites, environment setup, database initialization, seed key, first run.
- [API Reference](docs/api-reference.md) — routes, authentication, request examples, idempotency, and errors.
- [Security Guide](docs/security.md) — API key handling, tenant isolation, payment-data boundaries, and limitations.
- [Troubleshooting](docs/troubleshooting.md) — Docker, Prisma, auth, CORS, ports, and CI issues.
- [Architecture](docs/architecture.md) — system boundaries and design decisions.
- [Roadmap](docs/roadmap.md) — implementation status and planned work.
- [Contributing](CONTRIBUTING.md) — contribution workflow.
- [Security reporting](SECURITY.md) — how to report vulnerabilities.

## Current implementation

- Responsive Next.js dashboard with fictional sample metrics.
- NestJS API and database-backed health endpoint.
- Merchant-scoped API key authentication with test/live environment checks and route scopes.
- Customer create/list/retrieve API.
- PaymentIntent create/list/retrieve API.
- Merchant-scoped idempotency with canonical request fingerprint checks.
- PostgreSQL schema for merchants, API keys, customers, payment intents, attempts, and idempotency.
- Docker Compose for local PostgreSQL and Redis. Redis is provisioned but not yet connected to a worker.
- GitHub Actions workflow for install, build, typecheck, and tests.

## Quick start

See the full [Getting Started guide](docs/getting-started.md). In brief:

```bash
git clone https://github.com/fuzavhora/payflow.git
cd payflow
git switch feat/payflow-foundation
cp env.example .env
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:migrate
PAYFLOW_SEED_MERCHANT_NAME="Local Demo" PAYFLOW_SEED_MERCHANT_SLUG="local-demo" pnpm db:seed:merchant
pnpm dev
```

Web dashboard: http://localhost:3000  
API health: http://localhost:4000/api/v1/health

## API at a glance

- `POST /api/v1/customers`
- `GET /api/v1/customers`
- `GET /api/v1/customers/{id}`
- `POST /api/v1/payment-intents`
- `GET /api/v1/payment-intents`
- `GET /api/v1/payment-intents/{id}`

All customer and payment routes require a scoped merchant API key. See the [API Reference](docs/api-reference.md) for complete examples.

## Product and compliance boundary

PayFlow is an application and orchestration layer, not a bank, acquirer, card network, or licensed payment processor. External licensed providers must execute payment transactions. Never store raw PAN, CVV, PIN, or track data. No PCI DSS compliance claim is made. Do not use this development build with real cardholder data or real payment traffic.

No license has been selected yet. Until a license file is added, all rights are reserved by default.
