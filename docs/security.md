# Security Guide

PayFlow is an early-stage development project. This document describes implemented controls and important limitations; it is not a security certification or compliance statement.

## API key handling

- The local seed script generates high-entropy test keys.
- The database stores a SHA-256 digest, not the full API key.
- A public key prefix locates the record; the supplied key is verified using a constant-time digest comparison.
- Keys have test/live environment metadata, scopes, expiry and revocation fields.
- The API resolves merchant identity from the authenticated key. Never trust client-controlled merchant IDs for authorization.
- The seed script prints the full key once. Store it securely.

## Rules for developers

1. Never commit .env, API keys, provider secrets, database credentials or private certificates.
2. Never put secret keys in Next.js client components, browser local storage, URLs, analytics events or screenshots.
3. Do not log Authorization headers, signing secrets, payment credentials or sensitive customer data.
4. Use separate credentials and databases for local, test, staging and production environments.
5. Rotate exposed credentials and revoke compromised API keys.
6. Use least-privilege scopes.
7. Validate ownership at every resource boundary.
8. Keep dependencies updated and review security advisories before deployment.

## Payment data boundary

PayFlow does not accept card number, CVV, PIN, magnetic-stripe track data or bank authentication secrets. Do not add endpoints or database fields to store these values.

When a provider integration is added, prefer provider-hosted checkout, hosted fields and provider tokenization. Send provider tokens/references through the server-side adapter; do not route raw card data through PayFlow.

## Webhook security controls

- Signing secrets are generated with cryptographic randomness and encrypted at rest using AES-256-GCM.
- Configure PAYFLOW_WEBHOOK_ENCRYPTION_KEY as 32 bytes encoded in 64 hexadecimal characters. Keep it in a secret manager.
- Plaintext signing secrets are returned once on creation and rotation.
- Secret rotation retains the previous encrypted signing secret for a bounded receiver-side verification grace period. A second rotation is blocked while that grace period is active.
- Outbound delivery requires HTTPS, DNS resolution screening, address pinning, TLS certificate verification, no redirect following, bounded timeout and capped response consumption.
- Delivery APIs are merchant-scoped and protected by webhooks:read / webhooks:write scopes.
- Delivery is at least once. Consumers must verify the raw request body signature and deduplicate by event ID.

The transport address policy still requires review against current IANA special-purpose registries and deployment-specific egress policy. Encryption-key rotation for PAYFLOW_WEBHOOK_ENCRYPTION_KEY, production secret-manager integration, metrics, alerting and external penetration testing are not implemented.

## Compliance and operational boundary

- No PCI DSS compliance claim is made.
- No production security review, penetration test, threat model sign-off or compliance assessment has been completed.
- No live payment processing or real money movement is implemented.
- Provider integrations, provider reconciliation, production-grade key management, rate limiting, audit logging, metrics and alerting remain outstanding.
- PayFlow is not a bank, acquirer, card network or licensed payment processor. External licensed providers must execute payment transactions.

Do not use this development build with real cardholder data or real payment traffic.
