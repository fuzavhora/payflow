# Contributing to PayFlow

Thanks for considering a contribution.

## Before starting

1. Search existing issues and pull requests.
2. For significant changes, open an issue describing the problem and proposed approach.
3. Keep changes focused and avoid unrelated refactoring.
4. Never include credentials, real payment data, or customer information in issues, tests, fixtures, or logs.

## Development expectations

- Use TypeScript with strict compiler settings.
- Prefer explicit domain types over loosely typed payloads.
- Keep provider-specific behavior inside provider adapters.
- Use integer minor units and explicit currency codes for monetary values.
- Add tests for state transitions, idempotency, tenant isolation, and failure paths.
- Document API and schema changes.
- Do not introduce a dependency without explaining why it is needed.

## Pull requests

A pull request should include:
- Problem statement and rationale.
- Summary of implementation.
- Tests executed and their results.
- Migration or compatibility impact.
- Security and operational considerations.
- Screenshots for user-interface changes where relevant.

Do not submit changes that claim PCI compliance or bypass provider security controls.
