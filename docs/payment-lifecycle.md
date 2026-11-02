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

The pure domain policy is implemented under `apps/api/src/payments/domain`. Internal transition services use merchant-scoped conditional updates.

## PaymentAttempt and event lifecycle

An internal PaymentAttempt service:
1. Verifies merchant ownership and the valid source state.
2. Atomically transitions the intent to `PROCESSING`, creates a `CREATED` attempt, and writes a `payment_intent.processing` outbox event.
3. Leaves provider network I/O to the caller after the transaction commits.
4. Atomically records normalized provider results, terminal intent transitions, and outbox events.
5. Keeps pending or unknown outcomes in processing for later reconciliation.

The outbox record and corresponding state change commit together. Event payloads contain normalized metadata only, not raw provider payloads or cardholder data. Event insertion is deduplicated by a merchant-scoped key.

## Provider boundary

The provider-neutral contract lives at `apps/api/src/payments/providers/payment-provider.contract.ts`. No concrete provider adapter or provider execution wiring is configured. Customer-action results are rejected until a secure customer-action state and return flow exist.

## Outbox delivery status

The durable outbox schema and transactional event writes are implemented. A dispatcher, lease recovery, delivery retries, dead-letter operations, and webhook endpoints are not implemented. Therefore events are persisted but not yet delivered.

See [Transactional Outbox](transactional-outbox.md) for the delivery design.

## Reliability rules

- Never hold a database transaction open during provider I/O.
- Treat network timeouts as unknown outcomes, not proof of failure.
- Assume webhook delivery is at-least-once; consumers must deduplicate.
- Use bounded retries with exponential backoff and jitter.
- Reconcile ambiguous provider outcomes against provider truth.
- Never move terminal intents back into processing.

## Current limitations

No concrete provider, payment execution, capture, refunds, customer-action flow, outbox dispatcher, webhook delivery, reconciliation worker, or ledger is implemented. PayFlow is not a licensed processor and this is not a PCI compliance or production readiness claim.
