import { WebhookDeliveryStatus } from "@prisma/client";
import { WebhookDeliveryWorkerService } from "./webhook-delivery-worker.service";
import { PrismaService } from "../prisma/prisma.service";
import { OutboxDispatcherService } from "./outbox-dispatcher.service";
import { WebhookDeliveryService } from "./webhook-delivery.service";
import { WebhookEndpointsService } from "./webhook-endpoints.service";
import { WebhookSignatureService } from "./webhook-signature.service";
import { SecureWebhookHttpTransport } from "./secure-webhook-http-transport.service";

describe("WebhookDeliveryWorkerService", () => {
  let worker: WebhookDeliveryWorkerService;
  const prisma = { $transaction: jest.fn(), webhookDelivery: { findFirst: jest.fn() } };
  const outbox = { dispatchOnce: jest.fn() };
  const deliveries = { fanout: jest.fn() };
  const endpoints = { getSecretForDelivery: jest.fn() };
  const signatures = { sign: jest.fn() };
  const transport = { post: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new WebhookDeliveryWorkerService(
      prisma as unknown as PrismaService,
      outbox as unknown as OutboxDispatcherService,
      deliveries as unknown as WebhookDeliveryService,
      endpoints as unknown as WebhookEndpointsService,
      signatures as unknown as WebhookSignatureService,
      transport as unknown as SecureWebhookHttpTransport,
    );
  });

  it("validates worker options before touching the outbox", async () => {
    await expect(worker.runOnce({ batchSize: 0 })).rejects.toThrow(RangeError);
    expect(outbox.dispatchOnce).not.toHaveBeenCalled();
  });

  it("wires outbox acknowledgement to durable endpoint fanout", async () => {
    const message = {
      id: "evt_1", merchantId: "merchant_1", eventType: "payment_intent.succeeded",
      aggregateType: "payment_intent", aggregateId: "pi_1", payload: {}, attempts: 1,
    };
    outbox.dispatchOnce.mockImplementation(async (handler) => {
      await handler(message);
      return { claimed: 1, published: 1, retried: 0, deadLettered: 0 };
    });
    prisma.$transaction.mockImplementation(async (callback) => callback({
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    }));
    await worker.runOnce();
    expect(deliveries.fanout).toHaveBeenCalledWith(message);
  });

  it("records each claim as a durable numbered attempt", async () => {
    const claimed = [{
      id: "del_1", merchantId: "m_1", endpointId: "ep_1", outboxEventId: "evt_1",
      attempts: 4, attemptsInCycle: 2, lockToken: "lease_1",
    }];
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue(claimed),
      webhookDeliveryAttempt: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    const result = await (worker as any).claimDeliveries(10, 60);
    expect(result).toEqual(claimed);
    expect(tx.webhookDeliveryAttempt.create).toHaveBeenCalledWith({
      data: { deliveryId: "del_1", attemptNumber: 4 },
    });
  });

  it("does not update attempt history when a stale worker has lost its lease", async () => {
    const tx = {
      webhookDelivery: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      webhookDeliveryAttempt: { updateMany: jest.fn() },
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    await (worker as any).complete({
      id: "del_1", merchantId: "m_1", endpointId: "ep_1", outboxEventId: "evt_1",
      attempts: 2, attemptsInCycle: 1, lockToken: "stale_lease",
    }, { success: true, statusCode: 204, durationMs: 12 });
    expect(tx.webhookDelivery.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "del_1", status: WebhookDeliveryStatus.PROCESSING, lockToken: "stale_lease" },
    }));
    expect(tx.webhookDeliveryAttempt.updateMany).not.toHaveBeenCalled();
  });

  it("updates delivery and attempt atomically for the current lease owner", async () => {
    const tx = {
      webhookDelivery: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      webhookDeliveryAttempt: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    await (worker as any).complete({
      id: "del_1", merchantId: "m_1", endpointId: "ep_1", outboxEventId: "evt_1",
      attempts: 3, attemptsInCycle: 2, lockToken: "current_lease",
    }, { success: false, statusCode: 503, errorCode: "HTTP_503", errorMessage: "temporary", retryAt: new Date() });
    expect(tx.webhookDelivery.updateMany).toHaveBeenCalled();
    expect(tx.webhookDeliveryAttempt.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { deliveryId: "del_1", attemptNumber: 3, completedAt: null },
      data: expect.objectContaining({ statusCode: 503, errorCode: "HTTP_503" }),
    }));
  });
});

  it("processes claimed deliveries concurrently without exceeding configured concurrency", async () => {
    outbox.dispatchOnce.mockResolvedValue({ claimed: 0, published: 0, retried: 0, deadLettered: 0 });
    const claimed = Array.from({ length: 21 }, (_, index) => ({
      id: `del_${index}`, merchantId: "m_1", endpointId: "ep_1", outboxEventId: `evt_${index}`,
      attempts: index + 1, attemptsInCycle: 1, lockToken: `lease_${index}`,
    }));
    (worker as any).claimDeliveries = jest.fn().mockResolvedValue(claimed);
    let active = 0;
    let maximumActive = 0;
    (worker as any).processDelivery = jest.fn(async () => {
      active++;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
    });
    await worker.runOnce({ batchSize: 21, concurrency: 7, leaseSeconds: 60, timeoutMs: 8000 });
    expect((worker as any).processDelivery).toHaveBeenCalledTimes(21);
    expect(maximumActive).toBe(7);
  });

  it("rejects a lease budget that cannot cover configured processing waves", async () => {
    await expect(worker.runOnce({
      batchSize: 25, concurrency: 5, timeoutMs: 30000, leaseSeconds: 60,
    })).rejects.toThrow("Lease must be at least");
    expect(outbox.dispatchOnce).not.toHaveBeenCalled();
  });
