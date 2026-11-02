import { Injectable, Logger } from "@nestjs/common";
import { OutboxEventStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface OutboxMessage {
  id: string;
  merchantId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Prisma.JsonValue;
  attempts: number;
}
export interface OutboxDispatchOptions {
  batchSize?: number; leaseSeconds?: number; maxAttempts?: number;
  baseRetryDelayMs?: number; maxRetryDelayMs?: number;
}
export type OutboxDeliveryHandler = (message: OutboxMessage) => Promise<void>;
export interface OutboxDispatchSummary { claimed: number; published: number; retried: number; deadLettered: number; }

/** Generic at-least-once dispatcher. Claims are committed before destination I/O. */
@Injectable()
export class OutboxDispatcherService {
  private readonly logger = new Logger(OutboxDispatcherService.name);
  constructor(private readonly prisma: PrismaService) {}

  async dispatchOnce(deliver: OutboxDeliveryHandler, options: OutboxDispatchOptions = {}): Promise<OutboxDispatchSummary> {
    const batchSize = this.integerOption(options.batchSize, 25, 1, 500);
    const leaseSeconds = this.integerOption(options.leaseSeconds, 60, 5, 3600);
    const maxAttempts = this.integerOption(options.maxAttempts, 8, 1, 100);
    const baseRetryDelayMs = this.integerOption(options.baseRetryDelayMs, 1000, 100, 3600000);
    const maxRetryDelayMs = this.integerOption(options.maxRetryDelayMs, 3600000, baseRetryDelayMs, 86400000);

    const claimed = await this.prisma.$transaction(async (tx) =>
      tx.$queryRawUnsafe<OutboxMessage[]>(
        'WITH candidates AS ( SELECT "id" FROM "OutboxEvent" WHERE ("status" = \'PENDING\'::"OutboxEventStatus" AND "availableAt" <= NOW()) OR ("status" = \'PROCESSING\'::"OutboxEventStatus" AND "lockedAt" < NOW() - ($1 * INTERVAL \'1 second\')) ORDER BY "availableAt" ASC, "createdAt" ASC FOR UPDATE SKIP LOCKED LIMIT $2 ) UPDATE "OutboxEvent" AS event SET "status" = \'PROCESSING\'::"OutboxEventStatus", "attempts" = event."attempts" + 1, "lockedAt" = NOW() FROM candidates WHERE event."id" = candidates."id" RETURNING event."id", event."merchantId", event."eventType", event."aggregateType", event."aggregateId", event."payload", event."attempts"',
        leaseSeconds, batchSize,
      ),
    );

    const summary: OutboxDispatchSummary = { claimed: claimed.length, published: 0, retried: 0, deadLettered: 0 };
    for (const message of claimed) {
      try {
        await deliver(message);
        const ack = await this.prisma.outboxEvent.updateMany({
          where: { id: message.id, status: OutboxEventStatus.PROCESSING },
          data: { status: OutboxEventStatus.PUBLISHED, publishedAt: new Date(), lockedAt: null, lastError: null },
        });
        if (ack.count === 1) summary.published++;
        else this.logger.warn(`Acknowledgement lost for outbox event ${message.id}; redelivery is possible.`);
      } catch (error) {
        const deadLetter = message.attempts >= maxAttempts;
        const delay = this.retryDelay(message.attempts, baseRetryDelayMs, maxRetryDelayMs);
        const update = await this.prisma.outboxEvent.updateMany({
          where: { id: message.id, status: OutboxEventStatus.PROCESSING },
          data: deadLetter
            ? { status: OutboxEventStatus.DEAD_LETTER, lockedAt: null, lastError: this.safeErrorMessage(error) }
            : { status: OutboxEventStatus.PENDING, availableAt: new Date(Date.now() + delay), lockedAt: null, lastError: this.safeErrorMessage(error) },
        });
        if (update.count === 1) {
          if (deadLetter) summary.deadLettered++;
          else summary.retried++;
        } else this.logger.warn(`Failure update lost lease for outbox event ${message.id}.`);
      }
    }
    return summary;
  }

  private retryDelay(attempt: number, base: number, max: number): number {
    const ceiling = Math.min(max, base * 2 ** Math.max(0, attempt - 1));
    return Math.floor(ceiling / 2 + Math.random() * ceiling / 2);
  }
  private safeErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : "Destination delivery failed.";
    return message.replace(/[\r\n\t]+/g, " ").slice(0, 500) || "Destination delivery failed.";
  }
  private integerOption(value: number | undefined, fallback: number, min: number, max: number): number {
    if (value === undefined) return fallback;
    if (!Number.isInteger(value) || value < min || value > max) throw new RangeError(`Option must be an integer between ${min} and ${max}.`);
    return value;
  }
}
