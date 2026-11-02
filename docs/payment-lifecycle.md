# Payment Lifecycle and Provider Integration Boundary

## Current behavior

The API currently supports creating, listing, and retrieving local PaymentIntent records. Creation starts in `requires_payment_method`. No provider is called, no authorization or capture occurs, and no money moves.

## PaymentIntent state model

| Current state | Allowed next states |
| --- | --- |
| `requires_payment_method` | `requires_confirmation`, `canceled` |
| `requires_confirmation` | `processing`, `requires_payment_method`, `failed`, `canceled` |
| `processing` | `succeeded`, `failed` |
| `succeeded` | none (terminal) |
| `failed` | none (terminal) |
| `canceled` | none (terminal) |

The pure domain policy is implemented under `apps/api/src/payments/domain`. The internal transition service applies valid state changes using a merchant-scoped compare-and-swap update.

## PaymentAttempt persistence lifecycle

An internal `PaymentAttemptService` now provides the persistence boundary for a provider execution:

1. `beginAttempt` verifies merchant ownership and requires the intent to be in `requires_confirmation`.
2. In one short database transaction it changes the intent to `processing` and inserts a `CREATED` attempt.
3. The caller must commit this transaction before making any provider network request.
4. After the network call, `recordResult` stores a normalized provider result and atomically updates the intent to `succeeded` or `failed` when definitive.
5. A `pending` result keeps the intent in `processing`; a timeout/unknown result can be recorded as a pending attempt for later reconciliation.
6. A provider `requires_action` result is explicitly rejected for now because the current schema does not yet model a customer-action state or secure return flow.

Provider I/O must never occur inside the Prisma transaction. Attempt result application is conditional and rejects duplicate terminal updates. The service is internal and is not exposed as a public status mutation API.

## Provider adapter contract

`apps/api/src/payments/providers/payment-provider.contract.ts` defines a provider-neutral interface for creating and retrieving provider payments. A real adapter must execute server-to-server calls, use stable idempotency keys, return normalized results, preserve provider references, and verify webhook signatures. It must never accept or persist raw PAN, CVV, PIN, or magnetic-stripe track data.

No concrete provider adapter is currently implemented or configured. The new attempt service is a persistence boundary, not a claim that payment execution is operational.

## Reliability rules

- Persist an attempt before making an external provider request.
- Do not hold a database transaction open while waiting on a network call.
- Treat network timeouts as unknown outcomes, not proof of failure.
- Use a transactional outbox for committed domain events.
- Assume webhook delivery is at-least-once; deduplicate by provider event ID.
- Use bounded retries with exponential backoff and jitter.
- Reconcile ambiguous provider outcomes by retrieving provider state.
- Never move an intent from a terminal state back into processing.

## What is not implemented

Concrete provider adapters, provider execution wiring, customer action flows, retries, refunds, capture, webhook endpoints/delivery, outbox workers, reconciliation workers, and ledger accounting remain future work. PayFlow is not a licensed processor and this code is not a PCI compliance claim or production readiness claim.
