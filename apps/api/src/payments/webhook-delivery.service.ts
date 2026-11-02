import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { OutboxMessage } from "./outbox-dispatcher.service";

@Injectable()
export class WebhookDeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  async fanout(message: OutboxMessage): Promise<number> {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { merchantId: message.merchantId, enabled: true, events: { has: message.eventType } },
      select: { id: true },
    });
    if (endpoints.length === 0) return 0;
    const result = await this.prisma.webhookDelivery.createMany({
      data: endpoints.map((endpoint) => ({
        merchantId: message.merchantId,
        endpointId: endpoint.id,
        outboxEventId: message.id,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async replay(merchantId: string, deliveryId: string) {
    const updated = await this.prisma.webhookDelivery.updateMany({
      where: {
        id: deliveryId,
        merchantId,
        status: { in: ["FAILED", "DEAD_LETTER"] },
        endpoint: { is: { enabled: true } },
      },
      data: {
        status: "PENDING",
        attemptsInCycle: 0,
        nextAttemptAt: new Date(),
        lockedAt: null,
        lockToken: null,
        lastStatusCode: null,
        lastError: null,
      },
    });
    if (updated.count !== 1) {
      const existing = await this.prisma.webhookDelivery.findFirst({
        where: { id: deliveryId, merchantId },
        select: { id: true, status: true },
      });
      if (!existing) throw new NotFoundException("Webhook delivery not found.");
      throw new ConflictException("Only failed or dead-lettered deliveries with an enabled endpoint can be replayed.");
    }
    return this.getDelivery(merchantId, deliveryId);
  }

  async getDelivery(merchantId: string, deliveryId: string) {
    return this.prisma.webhookDelivery.findFirst({
      where: { id: deliveryId, merchantId },
      include: {
        attemptsLog: { orderBy: { attemptNumber: "asc" } },
        endpoint: { select: { id: true, url: true, enabled: true } },
        outboxEvent: { select: { id: true, eventType: true, aggregateId: true, payload: true, createdAt: true } },
      },
    });
  }

  async listDeliveries(merchantId: string, take = 50) {
    return this.prisma.webhookDelivery.findMany({
      where: { merchantId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(take, 1), 100),
      select: { id: true, endpointId: true, outboxEventId: true, status: true, attempts: true, attemptsInCycle: true, nextAttemptAt: true, lastStatusCode: true, lastError: true, deliveredAt: true, createdAt: true },
    });
  }
}
