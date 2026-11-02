import { PaymentIntentStatus } from "@prisma/client";

/**
 * Domain transition policy for PaymentIntent.
 *
 * This module is deliberately side-effect free. Persistence, provider calls,
 * retries, and webhook delivery belong to application services and workers.
 */
const ALLOWED_TRANSITIONS: Record<PaymentIntentStatus, readonly PaymentIntentStatus[]> = {
  [PaymentIntentStatus.REQUIRES_PAYMENT_METHOD]: [
    PaymentIntentStatus.REQUIRES_CONFIRMATION,
    PaymentIntentStatus.CANCELED,
  ],
  [PaymentIntentStatus.REQUIRES_CONFIRMATION]: [
    PaymentIntentStatus.PROCESSING,
    PaymentIntentStatus.REQUIRES_PAYMENT_METHOD,
    PaymentIntentStatus.FAILED,
    PaymentIntentStatus.CANCELED,
  ],
  [PaymentIntentStatus.PROCESSING]: [
    PaymentIntentStatus.SUCCEEDED,
    PaymentIntentStatus.FAILED,
  ],
  [PaymentIntentStatus.SUCCEEDED]: [],
  [PaymentIntentStatus.FAILED]: [],
  [PaymentIntentStatus.CANCELED]: [],
};

export class InvalidPaymentIntentTransitionError extends Error {
  constructor(readonly from: PaymentIntentStatus, readonly to: PaymentIntentStatus) {
    super(`PaymentIntent cannot transition from ${from} to ${to}.`);
    this.name = "InvalidPaymentIntentTransitionError";
  }
}

export function canTransitionPaymentIntent(
  from: PaymentIntentStatus,
  to: PaymentIntentStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertPaymentIntentTransition(
  from: PaymentIntentStatus,
  to: PaymentIntentStatus,
): void {
  if (!canTransitionPaymentIntent(from, to)) {
    throw new InvalidPaymentIntentTransitionError(from, to);
  }
}

export function getAllowedPaymentIntentTransitions(
  from: PaymentIntentStatus,
): readonly PaymentIntentStatus[] {
  return ALLOWED_TRANSITIONS[from];
}
