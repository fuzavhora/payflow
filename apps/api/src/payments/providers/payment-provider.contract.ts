/**
 * Provider-neutral contract for future payment integrations.
 *
 * Implementations must call licensed external providers server-side. They must
 * never accept raw cardholder data through PayFlow. This interface is not wired
 * into an API endpoint yet; it defines the boundary for the next integration.
 */
export type ProviderPaymentStatus = "pending" | "succeeded" | "failed" | "requires_action";

export interface CreateProviderPaymentInput {
  paymentIntentId: string;
  amountMinor: string;
  currency: string;
  idempotencyKey: string;
  returnUrl?: string;
  metadata?: Record<string, string>;
}

export interface ProviderPaymentResult {
  provider: string;
  providerReference: string;
  status: ProviderPaymentStatus;
  actionUrl?: string;
  failureCode?: string;
  failureMessage?: string;
  rawProviderPayload?: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: string;
  createPayment(input: CreateProviderPaymentInput): Promise<ProviderPaymentResult>;
  retrievePayment(providerReference: string): Promise<ProviderPaymentResult>;
}
