# Security Guide

PayFlow is an early-stage development project. This document describes implemented controls and important limitations; it is not a security certification or compliance statement.

## API key handling

- The local seed script generates high-entropy test keys.
- The database stores a SHA-256 digest, not the full API key.
- A public key prefix is used to locate the record; the full supplied key is verified using a constant-time digest comparison.
- Keys have test/live environment metadata, scopes, expiry, and revocation fields.
- The API resolves merchant identity from the authenticated key. Do not add client-controlled merchant IDs to authorization decisions.
- The seed script prints the full key once. Save it securely.

## Rules for developers

1. Never commit `.env`, API keys, provider secrets, database credentials, or private certificates.
2. Never put secret keys in Next.js client components, browser local storage, URLs, analytics events, or screenshots.
3. Do not log Authorization headers, payment credentials, or sensitive customer data.
4. Use separate credentials and databases for local, test, staging, and production environments.
5. Rotate a key if it is exposed. Revocation is currently a database-level capability; a key-management API/UI is not implemented.
6. Use least-privilege scopes. Do not give read/write scopes to keys that do not need them.
7. Validate ownership at every resource boundary. Never trust a customer ID or resource ID supplied by a caller without checking its merchant relationship.
8. Keep dependencies updated and review security advisories before deployment.

## Payment data boundary

PayFlow currently does not accept card number, CVV, PIN, magnetic-stripe track data, or bank authentication secrets. Do not add endpoints or database fields to store these values.

When a provider integration is added, prefer provider-hosted checkout, hosted fields, and provider tokenization. Send provider tokens/references through the server-side adapter; do not route raw card data through PayFlow.

## Compliance and operational boundary

- No PCI DSS compliance claim is made.
- No production security review, penetration test, threat model sign-off, or compliance assessment has been completed.
- No live payment processing is implemented.
- Rate limiting, audit logging, secret rotation workflows, webhook signature verification, alerting, and production-grade key management are outstanding.
- The platform is not a bank, acquirer, card network, or licensed payment processor. External licensed providers must execute payment transactions.

Do not use this development build with real cardholder data or real payment traffic.


## Webhook endpoint security

Webhook signing secrets are generated with cryptographic randomness and encrypted using AES-256-GCM. Configure `PAYFLOW_WEBHOOK_ENCRYPTION_KEY` (32 bytes encoded as 64 hex characters) outside source control. The plaintext secret is returned once on endpoint creation. Endpoint APIs are merchant-scoped and require dedicated webhook scopes. HTTPS and basic hostname checks are enforced, but outbound delivery must not be enabled until DNS/IP SSRF defenses, redirect policy, request signing, and delivery timeouts are implemented.
