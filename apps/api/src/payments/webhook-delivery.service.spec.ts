import { ConflictException, NotFoundException } from "@nestjs/common";
import { WebhookDeliveryService } from "./webhook-delivery.service";
import { PrismaService } from "../prisma/prisma.service";

describe("WebhookDeliveryService", () => {
  let service: WebhookDeliveryService;
  const prisma = {
    webhookEndpoint: { findMany: jest.fn() },
    webhookDelivery: { createMany: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
  };
  beforeEach(() => {
    jest.clearAllMocks();
    service = new WebhookDeliveryService(prisma as unknown as PrismaService);
  });

  it("fans out only to enabled merchant endpoints subscribed to the event", async () => {
    prisma.webhookEndpoint.findMany.mockResolvedValue([{ id: "ep_1" }, { id: "ep_2" }]);
    prisma.webhookDelivery.createMany.mockResolvedValue({ count: 2 });
    const result = await service.fanout({
      id: "evt_1", merchantId: "m_1", eventType: "payment_intent.succeeded",
      aggregateType: "payment_intent", aggregateId: "pi_1", payload: {}, attempts: 1,
    });
    expect(result).toBe(2);
    expect(prisma.webhookEndpoint.findMany).toHaveBeenCalledWith({
      where: { merchantId: "m_1", enabled: true, events: { has: "payment_intent.succeeded" } },
      select: { id: true },
    });
    expect(prisma.webhookDelivery.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: expect.arrayContaining([expect.objectContaining({ merchantId: "m_1", endpointId: "ep_1", outboxEventId: "evt_1" })]),
    }));
  });

  it("returns zero when no endpoint subscribes", async () => {
    prisma.webhookEndpoint.findMany.mockResolvedValue([]);
    expect(await service.fanout({
      id: "evt_1", merchantId: "m_1", eventType: "unhandled.event",
      aggregateType: "payment_intent", aggregateId: "pi_1", payload: {}, attempts: 1,
    })).toBe(0);
    expect(prisma.webhookDelivery.createMany).not.toHaveBeenCalled();
  });

  it("never retrieves a delivery outside the authenticated merchant", async () => {
    prisma.webhookDelivery.findFirst.mockResolvedValue(null);
    await service.getDelivery("m_1", "del_1");
    expect(prisma.webhookDelivery.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "del_1", merchantId: "m_1" } }));
  });

  it("replays a failed delivery while preserving lifetime attempt history", async () => {
    prisma.webhookDelivery.updateMany.mockResolvedValue({ count: 1 });
    prisma.webhookDelivery.findFirst.mockResolvedValue({ id: "del_1", status: "PENDING", attempts: 5, attemptsInCycle: 0 });
    const result = await service.replay("m_1", "del_1");
    expect(prisma.webhookDelivery.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "del_1", merchantId: "m_1", status: { in: ["FAILED", "DEAD_LETTER"] }, endpoint: { is: { enabled: true } } },
      data: expect.objectContaining({ status: "PENDING", attemptsInCycle: 0 }),
    }));
    expect(result).toMatchObject({ id: "del_1", status: "PENDING" });
  });

  it("does not replay an active or successful delivery", async () => {
    prisma.webhookDelivery.updateMany.mockResolvedValue({ count: 0 });
    prisma.webhookDelivery.findFirst.mockResolvedValue({ id: "del_1", status: "SUCCEEDED" });
    await expect(service.replay("m_1", "del_1")).rejects.toThrow(ConflictException);
  });

  it("does not disclose deliveries belonging to another merchant on replay", async () => {
    prisma.webhookDelivery.updateMany.mockResolvedValue({ count: 0 });
    prisma.webhookDelivery.findFirst.mockResolvedValue(null);
    await expect(service.replay("m_1", "del_other")).rejects.toThrow(NotFoundException);
  });
});
