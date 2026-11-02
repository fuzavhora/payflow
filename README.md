# PayFlow

[![GitHub stars](https://img.shields.io/github/stars/fuzavhora/payflow?style=social)](https://github.com/fuzavhora/payflow/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/fuzavhora/payflow?style=social)](https://github.com/fuzavhora/payflow/network/members)
[![GitHub issues](https://img.shields.io/github/issues/fuzavhora/payflow)](https://github.com/fuzavhora/payflow/issues)

An open-source, developer-first payments and billing platform.

> Early development / demo stage. The dashboard uses fictional sample data. The API foundation is under construction. Do not process real payments or sensitive cardholder data with this project.

## Current implementation
- Responsive Next.js dashboard with fictional sample metrics.
- NestJS API bootstrap and database-backed health endpoint.
- PostgreSQL schema for merchants, customers, payment intents, attempts, and idempotency.
- Docker Compose for local PostgreSQL and Redis.
- Redis is provisioned but not yet connected to a worker.

## Local development
Requirements: Node.js 20+, pnpm 9+, Docker.

1. Copy env.example to .env.
2. Start infrastructure: docker compose up -d.
3. Install packages: pnpm install.
4. Generate Prisma client: pnpm db:generate.
5. Apply local migrations: pnpm db:migrate.
6. Start apps: pnpm dev.

Web: http://localhost:3000  
API health: http://localhost:4000/api/v1/health

PayFlow is an application and orchestration layer, not a bank, acquirer, card network, or licensed payment processor. Payment execution will be delegated to appropriately licensed providers. Never store raw PAN, CVV, PIN, or track data. Do not claim PCI DSS compliance without formal assessment.

No license has been selected yet. Until a license file is added, all rights are reserved by default.
