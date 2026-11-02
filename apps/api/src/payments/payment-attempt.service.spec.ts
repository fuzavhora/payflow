import { ConflictException, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { PaymentAttemptStatus, PaymentIntentStatus } from "@prisma/client";
import { PaymentAttemptService } from "./payment-attempt.service";

describe("PaymentAttemptService", () => {
  const tx = {
    paymentIntent: { findFirst: jest.fn(), updateMany: jest.fn() },
    paymentAttempt: { create: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn() },
  };
  const prisma = { $transaction: jest.fn() };
  let service: PaymentAttemptService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    service = new PaymentAttemptService(prisma as never);
  });

  it("moves a confirmation-ready intent to processing and creates the attempt atomically", async () => {
    tx.paymentIntent.findFirst.mockResolvedValue({ id: "pi_1", status: PaymentIntentStatus.REQUIRES_CONFIRMATION });
    tx.paymentIntent.updateMany.mockResolvedValue({ count: 1 });
    tx.paymentAttempt.create.mockResolvedValue({ id: "pa_1", status: PaymentAttemptStatus.CREATED });

    const result = await service.beginAttempt("merchant_1", "pi_1", "mock_provider");

    expect(tx.paymentIntent.updateMany).toHaveBeenCalledWith({
      where: { id: "pi_1", merchantId: "merchant_1", status: PaymentIntentStatus.REQUIRES_CONFIRMATION },
      data: { status: PaymentIntentStatus.PROCESSING },
    });
    expect(tx.paymentAttempt.create).toHaveBeenCalledWith({
      data: { paymentIntentId: "pi_1", provider: "mock_provider", status: PaymentAttemptStatus.CREATED },
    });
    expect(result.id).toBe("pa_1");
  });

  it("does not create an attempt for another merchant's intent", async () => {
    tx.paymentIntent.findFirst.mockResolvedValue(null);
    await expect(service.beginAttempt("merchant_a", "pi_other", "mock_provider")).rejects.toThrow(NotFoundException);
    expect(tx.paymentAttempt.create).not.toHaveBeenCalled();
  });

  it("rejects attempts from an invalid PaymentIntent state", async () => {
    tx.paymentIntent.findFirst.mockResolvedValue({ id: "pi_1", status: PaymentIntentStatus.REQUIRES_PAYMENT_METHOD });
    await expect(service.beginAttempt("merchant_1", "pi_1", "mock_provider")).rejects.toThrow(UnprocessableEntityException);
    expect(tx.paymentIntent.updateMany).not.toHaveBeenCalled();
  });

  it("records a provider success and transitions the intent in one transaction", async () => {
    tx.paymentAttempt.findFirst.mockResolvedValue({
      id: "pa_1",
      provider: "mock_provider",
      status: PaymentAttemptStatus.CREATED,
      paymentIntent: { id: "pi_1", status: PaymentIntentStatus.PROCESSING },
    });
    tx.paymentAttempt.updateMany.mockResolvedValue({ count: 1 });
    tx.paymentIntent.updateMany.mockResolvedValue({ count: 1 });
    tx.paymentAttempt.findUnique.mockResolvedValue({ id: "pa_1", status: PaymentAttemptStatus.SUCCEEDED });

    const result = await service.recordResult("merchant_1", "pa_1", {
      provider: "mock_provider", providerReference: "mock_ref_1", status: "succeeded",
    });

    expect(tx.paymentIntent.updateMany).toHaveBeenCalledWith({
      where: { id: "pi_1", merchantId: "merchant_1", status: PaymentIntentStatus.PROCESSING },
      data: { status: PaymentIntentStatus.SUCCEEDED },
    });
    expect(result?.status).toBe(PaymentAttemptStatus.SUCCEEDED);
  });

  it("keeps an intent processing for pending provider outcomes", async () => {
    tx.paymentAttempt.findFirst.mockResolvedValue({
      id: "pa_1", provider: "mock_provider", status: PaymentAttemptStatus.CREATED,
      paymentIntent: { id: "pi_1", status: PaymentIntentStatus.PROCESSING },
    });
    tx.paymentAttempt.updateMany.mockResolvedValue({ count: 1 });
    tx.paymentAttempt.findUnique.mockResolvedValue({ id: "pa_1", status: PaymentAttemptStatus.PENDING });

    await service.recordResult("merchant_1", "pa_1", {
      provider: "mock_provider", providerReference: "mock_ref_1", status: "pending",
    });

    expect(tx.paymentIntent.updateMany).not.toHaveBeenCalled();
  });

  it("does not accept an unimplemented customer-action result", async () => {
    tx.paymentAttempt.findFirst.mockResolvedValue({
      id: "pa_1", provider: "mock_provider", status: PaymentAttemptStatus.CREATED,
      paymentIntent: { id: "pi_1", status: PaymentIntentStatus.PROCESSING },
    });
    await expect(service.recordResult("merchant_1", "pa_1", {
      provider: "mock_provider", providerReference: "mock_ref_1", status: "requires_action",
    })).rejects.toThrow(UnprocessableEntityException);
    expect(tx.paymentAttempt.updateMany).not.toHaveBeenCalled();
  });

  it("rejects duplicate terminal result application", async () => {
    tx.paymentAttempt.findFirst.mockResolvedValue({
      id: "pa_1", provider: "mock_provider", status: PaymentAttemptStatus.SUCCEEDED,
      paymentIntent: { id: "pi_1", status: PaymentIntentStatus.SUCCEEDED },
    });
    await expect(service.recordResult("merchant_1", "pa_1", {
      provider: "mock_provider", providerReference: "mock_ref_1", status: "succeeded",
    })).rejects.toThrow(ConflictException);
  });
});
