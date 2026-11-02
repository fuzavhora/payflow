# Contributing to PayFlow

Thanks for considering a contribution.

## Before starting

1. Read [Getting Started](docs/getting-started.md) and [Architecture](docs/architecture.md).
2. Search existing issues and pull requests.
3. For significant changes, open an issue describing the problem and proposed approach.
4. Keep changes focused and avoid unrelated refactoring.
5. Never include credentials, real payment data, or customer information in issues, tests, fixtures, or logs.

## Development expectations

- Use TypeScript with strict compiler settings.
- Prefer explicit domain types over loosely typed payloads.
- Keep provider-specific behavior inside provider adapters.
- Use integer minor units and explicit currency codes for monetary values.
- Add tests for state transitions, idempotency, tenant isolation, and failure paths.
- Document API and schema changes in the same pull request.
- Do not introduce a dependency without explaining why it is needed.
- Preserve merchant isolation: derive tenant identity from authenticated server-side context, never from request-body fields.
- Never store raw PAN, CVV, PIN, or magnetic-stripe track data.

## Local validation

Before opening a pull request, run the applicable checks from the repository root:

```bash
pnpm db:generate
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

If a check cannot be run, state that explicitly in the pull request rather than claiming it passed.

## Pull requests

A pull request should include:
- Problem statement and rationale.
- Summary of implementation.
- Tests executed and their results.
- Migration or compatibility impact.
- Security and operational considerations.
- Screenshots for user-interface changes where relevant.

Do not submit changes that claim PCI compliance, represent local PaymentIntent creation as a completed payment, or bypass provider security controls.
