import { OutboxEventStatus } from "@prisma/client";
import { OutboxDispatcherService, OutboxMessage } from "./outbox-dispatcher.service";
import { PrismaService } from "../prisma/prisma.service";

describe("OutboxDispatcherService", () => {
  let service: OutboxDispatcherService;
  let prisma: { $transaction: jest.Mock; outboxEvent: { updateMany: jest.Mock } };
  const event: OutboxMessage = {
    id: "evt_1", merchantId: "merchant_1", eventType: "payment_intent.succeeded",
    aggregateType: "payment_intent", aggregateId: "pi_1", payload: { paymentIntentId: "pi_1" }, attempts: 1, lockToken: "claim-token",
  };
  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (cb) => cb({ $queryRawUnsafe: jest.fn().mockResolvedValue([event]) })),
      outboxEvent: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    service = new OutboxDispatcherService(prisma as unknown as PrismaService);
  });
  it("publishes after the destination acknowledges", async () => {
    const deliver = jest.fn().mockResolvedValue(undefined);
    const result = await service.dispatchOnce(deliver);
    expect(deliver).toHaveBeenCalledWith(expect.not.objectContaining({ lockToken: expect.any(String) }));
    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: event.id, status: OutboxEventStatus.PROCESSING, lockToken: event.lockToken },
      data: expect.objectContaining({ status: OutboxEventStatus.PUBLISHED, publishedAt: expect.any(Date) }),
    }));
    expect(result).toEqual({ claimed: 1, published: 1, retried: 0, deadLettered: 0 });
  });
  it("retries a failed delivery with a future availability time", async () => {
    const result = await service.dispatchOnce(jest.fn().mockRejectedValue(new Error("temporary error")));
    const data = prisma.outboxEvent.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe(OutboxEventStatus.PENDING);
    expect(data.availableAt).toBeInstanceOf(Date);
    expect(data.lastError).toBe("temporary error");
    expect(result.retried).toBe(1);
  });
  it("dead-letters an event after the configured attempt limit", async () => {
    const exhausted = { ...event, attempts: 3 };
    prisma.$transaction.mockImplementation(async (cb) => cb({ $queryRawUnsafe: jest.fn().mockResolvedValue([exhausted]) }));
    const result = await service.dispatchOnce(jest.fn().mockRejectedValue(new Error("permanent")), { maxAttempts: 3 });
    expect(prisma.outboxEvent.updateMany.mock.calls[0][0].data.status).toBe(OutboxEventStatus.DEAD_LETTER);
    expect(result.deadLettered).toBe(1);
  });
  it("validates options before claiming", async () => {
    await expect(service.dispatchOnce(jest.fn(), { batchSize: 0 })).rejects.toThrow(RangeError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
