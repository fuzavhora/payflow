# Payment Lifecycle and Provider Integration Boundary

## Current behavior

The API currently supports creating, listing, and retrieving local PaymentIntent records. Creation starts in `requires_payment_method`. No provider is called, no authorization or capture occurs, and no money moves.

## PaymentIntent state model

The domain state machine defines these allowed transitions:

| Current state | Allowed next states |
| --- | --- |
| `requires_payment_method` | `requires_confirmation`, `canceled` |
| `requires_confirmation` | `processing`, `requires_payment_method`, `failed`, `canceled` |
| `processing` | `succeeded`, `failed` |
| `succeeded` | none (terminal) |
| `failed` | none (terminal) |
| `canceled` | none (terminal) |

The pure domain policy is implemented under `apps/api/src/payments/domain` and has unit tests. An internal application service now applies valid transitions using a merchant-scoped conditional update (compare-and-swap on the observed status). If another worker changes the status first, the operation returns a conflict rather than overwriting the newer state.

The transition service is intentionally not exposed as a public status mutation endpoint. A merchant or browser client must not be able to mark a payment successful by submitting a status field. Future provider orchestration and verified webhook handling will be the trusted callers.

## Provider adapter contract

`apps/api/src/payments/providers/payment-provider.contract.ts` defines a provider-neutral interface for creating and retrieving provider payments. A real adapter must:

1. Execute only server-to-server calls using secret credentials held outside source control.
2. Use the PayFlow payment intent ID and a stable provider idempotency key to protect retries.
3. Return normalized provider status and provider reference.
4. Preserve provider references needed for later retrieval and reconciliation.
5. Treat network timeouts as unknown outcomes, not as proof of failure.
6. Never accept or persist raw PAN, CVV, PIN, or magnetic-stripe track data.
7. Verify provider webhook signatures before trusting asynchronous events.

No concrete provider adapter is currently implemented or configured.

## Reliability rules for future implementation

- Persist an attempt before making an external provider request.
- Do not hold a database transaction open while waiting on a network call.
- Use a transactional outbox to publish domain events after committed state changes.
- Assume webhook delivery is at-least-once; deduplicate by provider event ID.
- Use bounded retries with exponential backoff and jitter.
- Reconcile ambiguous provider outcomes by retrieving provider state.
- Never move an intent from a terminal state back into processing.
- Use optimistic concurrency or conditional updates so two workers cannot apply conflicting transitions.

## What is not implemented

Provider execution, attempt orchestration, refunds, capture, webhook endpoints, webhook delivery, outbox workers, reconciliation, and ledger accounting remain future work. This lifecycle design is not a claim of production readiness or payment-provider certification.
