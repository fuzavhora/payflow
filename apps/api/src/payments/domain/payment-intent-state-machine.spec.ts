import { PaymentIntentStatus as Status } from "@prisma/client";
import {
  assertPaymentIntentTransition,
  canTransitionPaymentIntent,
  getAllowedPaymentIntentTransitions,
  InvalidPaymentIntentTransitionError,
} from "./payment-intent-state-machine";

describe("PaymentIntent state machine", () => {
  it.each([
    [Status.REQUIRES_PAYMENT_METHOD, Status.REQUIRES_CONFIRMATION],
    [Status.REQUIRES_PAYMENT_METHOD, Status.CANCELED],
    [Status.REQUIRES_CONFIRMATION, Status.PROCESSING],
    [Status.REQUIRES_CONFIRMATION, Status.REQUIRES_PAYMENT_METHOD],
    [Status.REQUIRES_CONFIRMATION, Status.FAILED],
    [Status.REQUIRES_CONFIRMATION, Status.CANCELED],
    [Status.PROCESSING, Status.SUCCEEDED],
    [Status.PROCESSING, Status.FAILED],
  ])("allows %s -> %s", (from, to) => {
    expect(canTransitionPaymentIntent(from, to)).toBe(true);
    expect(() => assertPaymentIntentTransition(from, to)).not.toThrow();
  });

  it.each([
    [Status.REQUIRES_PAYMENT_METHOD, Status.PROCESSING],
    [Status.REQUIRES_PAYMENT_METHOD, Status.SUCCEEDED],
    [Status.REQUIRES_CONFIRMATION, Status.SUCCEEDED],
    [Status.PROCESSING, Status.CANCELED],
    [Status.SUCCEEDED, Status.FAILED],
    [Status.FAILED, Status.PROCESSING],
    [Status.CANCELED, Status.REQUIRES_PAYMENT_METHOD],
  ])("rejects %s -> %s", (from, to) => {
    expect(canTransitionPaymentIntent(from, to)).toBe(false);
    expect(() => assertPaymentIntentTransition(from, to)).toThrow(InvalidPaymentIntentTransitionError);
  });

  it("returns no outgoing transitions for terminal states", () => {
    expect(getAllowedPaymentIntentTransitions(Status.SUCCEEDED)).toEqual([]);
    expect(getAllowedPaymentIntentTransitions(Status.FAILED)).toEqual([]);
    expect(getAllowedPaymentIntentTransitions(Status.CANCELED)).toEqual([]);
  });

  it("does not expose a mutable transition table", () => {
    const transitions = getAllowedPaymentIntentTransitions(Status.PROCESSING);
    expect(transitions).toEqual([Status.SUCCEEDED, Status.FAILED]);
  });
});
