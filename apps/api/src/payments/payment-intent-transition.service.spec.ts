import { ConflictException, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { PaymentIntentStatus as Status } from "@prisma/client";
import { PaymentIntentTransitionService } from "./payment-intent-transition.service";

describe("PaymentIntentTransitionService", () => {
  const prisma = {
    paymentIntent: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  let service: PaymentIntentTransitionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PaymentIntentTransitionService(prisma as never);
  });

  it("applies an allowed transition with a merchant-scoped compare-and-swap", async () => {
    prisma.paymentIntent.findFirst
      .mockResolvedValueOnce({ id: "pi_1", status: Status.REQUIRES_PAYMENT_METHOD })
      .mockResolvedValueOnce({ id: "pi_1", status: Status.REQUIRES_CONFIRMATION });
    prisma.paymentIntent.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.transition("merchant_1", "pi_1", Status.REQUIRES_CONFIRMATION);

    expect(prisma.paymentIntent.updateMany).toHaveBeenCalledWith({
      where: {
        id: "pi_1",
        merchantId: "merchant_1",
        status: Status.REQUIRES_PAYMENT_METHOD,
      },
      data: { status: Status.REQUIRES_CONFIRMATION },
    });
    expect(result.data.status).toBe(Status.REQUIRES_CONFIRMATION);
  });

  it("does not disclose or mutate an intent belonging to another merchant", async () => {
    prisma.paymentIntent.findFirst.mockResolvedValue(null);

    await expect(
      service.transition("merchant_a", "pi_other", Status.CANCELED),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.paymentIntent.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an invalid domain transition before persistence", async () => {
    prisma.paymentIntent.findFirst.mockResolvedValue({
      id: "pi_1",
      status: Status.REQUIRES_PAYMENT_METHOD,
    });

    await expect(
      service.transition("merchant_1", "pi_1", Status.SUCCEEDED),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(prisma.paymentIntent.updateMany).not.toHaveBeenCalled();
  });

  it("returns a conflict when another worker wins the compare-and-swap", async () => {
    prisma.paymentIntent.findFirst.mockResolvedValue({
      id: "pi_1",
      status: Status.REQUIRES_PAYMENT_METHOD,
    });
    prisma.paymentIntent.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.transition("merchant_1", "pi_1", Status.CANCELED),
    ).rejects.toThrow(ConflictException);
  });
});
