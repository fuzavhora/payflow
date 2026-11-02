# PayFlow

[![GitHub stars](https://img.shields.io/github/stars/fuzavhora/payflow?style=social)](https://github.com/fuzavhora/payflow/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/fuzavhora/payflow?style=social)](https://github.com/fuzavhora/payflow/network/members)
[![GitHub issues](https://img.shields.io/github/issues/fuzavhora/payflow)](https://github.com/fuzavhora/payflow/issues)

**An open-source, developer-first payments and billing platform.**

PayFlow is being designed as a self-hostable platform for integrating payment providers, managing payment lifecycles, subscriptions, invoices, and webhooks through one consistent developer experience.

> **Project status: early development.** This repository is a foundation, not a production payment service. APIs, data models, and architecture may change. Do not use it to process real payments or sensitive cardholder data.

## Product direction

PayFlow aims to provide:

- A business dashboard for payments, customers, refunds, subscriptions, and invoices.
- A developer workspace for API credentials, webhook endpoints, event inspection, and API documentation.
- A provider-adapter layer that normalizes payment-provider integrations.
- Reliable payment lifecycle handling with idempotency, durable events, and reconciliation.
- A local sandbox for development and integration testing.

PayFlow is a payment orchestration and application platform. It is **not** a bank, acquirer, card network, or licensed payment processor. Actual payment execution will be delegated to appropriately licensed providers.

## Planned technology

| Layer | Initial choice |
|---|---|
| Web application | Next.js, React, TypeScript |
| API | NestJS, Node.js, TypeScript |
| Persistence | PostgreSQL, Prisma |
| Background processing | Redis, BullMQ |
| API contract | REST + OpenAPI |
| Local development | Docker Compose |
| Quality gates | TypeScript, linting, tests, CI |

Technology choices are documented in [Architecture](docs/architecture.md) and can be revisited through documented decisions.

## Repository layout (planned)

```text
payflow/
├── apps/
│   ├── api/             # NestJS API
│   └── web/             # Next.js dashboard and public site
├── packages/
│   ├── contracts/       # Shared API contracts and schemas
│   └── provider-sdk/    # Provider adapter interfaces
├── docs/
│   ├── architecture.md
│   └── roadmap.md
├── CONTRIBUTING.md
└── SECURITY.md
```

## Getting started

The runnable application scaffold is the next implementation milestone. Until the initial app scaffold and environment template are committed, there is no supported local run command.

## Security principles

- Never store raw PAN, CVV, PIN, or other sensitive authentication data.
- Prefer provider-hosted checkout or provider tokenization to keep card data outside PayFlow systems.
- Treat webhook delivery as at-least-once; consumers must be idempotent.
- Keep secrets out of source control and logs.
- Do not claim PCI DSS compliance without a formal scope assessment and independent validation.

See [SECURITY.md](SECURITY.md) for reporting guidance.

## Contributing

Contributions are welcome once the initial contribution workflow is in place. Read [CONTRIBUTING.md](CONTRIBUTING.md) and open an issue before large or breaking changes.

## Roadmap

See [docs/roadmap.md](docs/roadmap.md) for the staged delivery plan.

## License

A license has not yet been selected. Until a license file is added, all rights are reserved by default; do not assume this repository is currently licensed for reuse.
