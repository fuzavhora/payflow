import { Injectable, Logger } from "@nestjs/common";
import { WebhookDeliveryStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { OutboxDispatcherService } from "./outbox-dispatcher.service";
import { WebhookDeliveryService } from "./webhook-delivery.service";
import { WebhookEndpointsService } from "./webhook-endpoints.service";
import { WebhookSignatureService } from "./webhook-signature.service";
import { SecureWebhookHttpTransport } from "./secure-webhook-http-transport.service";

interface ClaimedDelivery {
  id: string;
  merchantId: string;
  endpointId: string;
  outboxEventId: string;
  attempts: number;
  attemptsInCycle: number;
  lockToken: string;
}

export interface WebhookWorkerOptions {
  batchSize?: number;
  leaseSeconds?: number;
  maxAttempts?: number;
  timeoutMs?: number;
  concurrency?: number;
  baseRetryDelayMs?: number;
  maxRetryDelayMs?: number;
}

export interface WebhookWorkerSummary {
  outbox: { claimed: number; published: number; retried: number; deadLettered: number };
  deliveries: { claimed: number; succeeded: number; retried: number; failed: number; deadLettered: number };
}

class PermanentWebhookDeliveryError extends Error {
  constructor(message: string, readonly statusCode?: number, readonly errorCode = "PERMANENT_DELIVERY_ERROR") {
    super(message);
    this.name = "PermanentWebhookDeliveryError";
  }
}

class WebhookHttpStatusError extends Error {
  constructor(readonly statusCode: number) {
    super(`Webhook endpoint returned HTTP ${statusCode}.`);
    this.name = "WebhookHttpStatusError";
  }
}

/** Separate-process worker with durable fanout and at-least-once endpoint delivery. */
@Injectable()
export class WebhookDeliveryWorkerService {
  private readonly logger = new Logger(WebhookDeliveryWorkerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxDispatcherService,
    private readonly deliveries: WebhookDeliveryService,
    private readonly endpoints: WebhookEndpointsService,
    private readonly signatures: WebhookSignatureService,
    private readonly transport: SecureWebhookHttpTransport,
  ) {}

  async runOnce(options: WebhookWorkerOptions = {}): Promise<WebhookWorkerSummary> {
    const batchSize = this.integerOption(options.batchSize, 25, 1, 250);
    const leaseSeconds = this.integerOption(options.leaseSeconds, 60, 10, 3600);
    const maxAttempts = this.integerOption(options.maxAttempts, 8, 1, 100);
    const timeoutMs = this.integerOption(options.timeoutMs, 8000, 500, 30000);
    const concurrency = this.integerOption(options.concurrency, 10, 1, 25);
    const minimumLeaseSeconds = Math.ceil((Math.ceil(batchSize / concurrency) * timeoutMs) / 1000) + 15;
    if (leaseSeconds < minimumLeaseSeconds) {
      throw new RangeError(`Lease must be at least ${minimumLeaseSeconds} seconds for the configured batch, concurrency and timeout.`);
    }
    const baseRetryDelayMs = this.integerOption(options.baseRetryDelayMs, 1000, 100, 3600000);
    const maxRetryDelayMs = this.integerOption(options.maxRetryDelayMs, 3600000, baseRetryDelayMs, 86400000);

    const outbox = await this.outbox.dispatchOnce(
      async (message) => { await this.deliveries.fanout(message); },
      { batchSize, leaseSeconds, maxAttempts, baseRetryDelayMs, maxRetryDelayMs },
    );

    const claimed = await this.claimDeliveries(batchSize, leaseSeconds);
    const summary = { claimed: claimed.length, succeeded: 0, retried: 0, failed: 0, deadLettered: 0 };

    for (let offset = 0; offset < claimed.length; offset += concurrency) {
      const wave = claimed.slice(offset, offset + concurrency);
      // Wait for every request in the wave even if a database acknowledgement fails.
      // Failed acknowledgements retain their lease and are recovered after expiry.
      const outcomes = await Promise.allSettled(wave.map((delivery) => this.processDelivery(
        delivery, timeoutMs, maxAttempts, baseRetryDelayMs, maxRetryDelayMs, summary,
      )));
      outcomes.forEach((outcome, index) => {
        if (outcome.status === "rejected") {
          this.logger.error(
            `Webhook delivery ${wave[index]?.id ?? "unknown"} could not be acknowledged; its lease will expire for recovery.`,
            outcome.reason instanceof Error ? outcome.reason.stack : String(outcome.reason),
          );
        }
      });
    }

    if (claimed.length > 0 || outbox.claimed > 0) {
      this.logger.log(`Webhook worker: ${outbox.published} outbox events fanned out; ${summary.succeeded} delivered, ${summary.retried} scheduled for retry, ${summary.failed} failed, ${summary.deadLettered} dead-lettered.`);
    }
    return { outbox, deliveries: summary };
  }

  private async processDelivery(
    delivery: ClaimedDelivery,
    timeoutMs: number,
    maxAttempts: number,
    baseRetryDelayMs: number,
    maxRetryDelayMs: number,
    summary: { succeeded: number; retried: number; failed: number; deadLettered: number },
  ): Promise<void> {
    try {
      const result = await this.send(delivery, timeoutMs);
      await this.complete(delivery, { success: true, statusCode: result.statusCode, durationMs: result.durationMs });
      summary.succeeded++;
    } catch (error) {
      const statusCode = error instanceof WebhookHttpStatusError || error instanceof PermanentWebhookDeliveryError
        ? error.statusCode : undefined;
      const permanent = error instanceof PermanentWebhookDeliveryError ||
        (statusCode !== undefined && statusCode >= 300 && statusCode < 500 && ![408, 409, 425, 429].includes(statusCode));
      const deadLetter = !permanent && delivery.attemptsInCycle >= maxAttempts;
      const outcome: {
        success: false;
        errorCode: string;
        errorMessage: string;
        terminalStatus?: WebhookDeliveryStatus;
        retryAt?: Date;
        statusCode?: number;
      } = {
        success: false,
        errorCode: error instanceof PermanentWebhookDeliveryError
          ? error.errorCode : statusCode !== undefined ? `HTTP_${statusCode}` : "DELIVERY_ERROR",
        errorMessage: this.safeErrorMessage(error),
      };
      if (statusCode !== undefined) outcome.statusCode = statusCode;
      if (permanent) outcome.terminalStatus = WebhookDeliveryStatus.FAILED;
      else if (deadLetter) outcome.terminalStatus = WebhookDeliveryStatus.DEAD_LETTER;
      else outcome.retryAt = new Date(Date.now() + this.retryDelay(delivery.attemptsInCycle, baseRetryDelayMs, maxRetryDelayMs));
      await this.complete(delivery, outcome);
      if (permanent) summary.failed++;
      else if (deadLetter) summary.deadLettered++;
      else summary.retried++;
    }
  }

  private async claimDeliveries(batchSize: number, leaseSeconds: number): Promise<ClaimedDelivery[]> {
    const lockToken = randomUUID();
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.$queryRawUnsafe<ClaimedDelivery[]>(
        'WITH candidates AS ( SELECT "id" FROM "WebhookDelivery" WHERE ("status" = \'PENDING\'::"WebhookDeliveryStatus" AND "nextAttemptAt" <= NOW()) OR ("status" = \'PROCESSING\'::"WebhookDeliveryStatus" AND "lockedAt" < NOW() - ($1 * INTERVAL \'1 second\')) ORDER BY "nextAttemptAt" ASC, "createdAt" ASC FOR UPDATE SKIP LOCKED LIMIT $2 ) UPDATE "WebhookDelivery" AS delivery SET "status" = \'PROCESSING\'::"WebhookDeliveryStatus", "attempts" = delivery."attempts" + 1, "attemptsInCycle" = delivery."attemptsInCycle" + 1, "lockedAt" = NOW(), "lockToken" = $3 FROM candidates WHERE delivery."id" = candidates."id" RETURNING delivery."id", delivery."merchantId", delivery."endpointId", delivery."outboxEventId", delivery."attempts", delivery."attemptsInCycle", delivery."lockToken"',
        leaseSeconds, batchSize, lockToken,
      );
      for (const delivery of claimed) {
        await tx.webhookDeliveryAttempt.updateMany({
          where: { deliveryId: delivery.id, completedAt: null },
          data: { completedAt: new Date(), errorCode: "LEASE_EXPIRED", errorMessage: "Previous worker lease expired." },
        });
        await tx.webhookDeliveryAttempt.create({ data: { deliveryId: delivery.id, attemptNumber: delivery.attempts } });
      }
      return claimed;
    });
  }

  private async send(delivery: ClaimedDelivery, timeoutMs: number) {
    const record = await this.prisma.webhookDelivery.findFirst({
      where: { id: delivery.id, merchantId: delivery.merchantId },
      include: {
        endpoint: { select: { id: true, url: true, enabled: true } },
        outboxEvent: { select: { id: true, eventType: true, payload: true, createdAt: true } },
      },
    });
    if (!record) throw new PermanentWebhookDeliveryError("Webhook delivery record no longer exists.", undefined, "DELIVERY_NOT_FOUND");
    if (!record.endpoint.enabled) throw new PermanentWebhookDeliveryError("Webhook endpoint is disabled.", undefined, "ENDPOINT_DISABLED");

    const secret = await this.endpoints.getSecretForDelivery(delivery.merchantId, delivery.endpointId);
    const envelope = {
      id: record.outboxEvent.id,
      type: record.outboxEvent.eventType,
      created: record.outboxEvent.createdAt.toISOString(),
      data: this.sortJson(record.outboxEvent.payload),
    };
    const body = Buffer.from(JSON.stringify(envelope), "utf8");
    const signature = this.signatures.sign(body, secret);
    const result = await this.transport.post(record.endpoint.url, body, {
      "content-type": "application/json",
      "user-agent": "PayFlow-Webhooks/0.1",
      "PayFlow-Signature": signature,
      "PayFlow-Event-Id": record.outboxEvent.id,
      "PayFlow-Delivery-Id": delivery.id,
    }, timeoutMs);
    if (result.statusCode < 200 || result.statusCode >= 300) throw new WebhookHttpStatusError(result.statusCode);
    return result;
  }

  private async complete(
    delivery: ClaimedDelivery,
    outcome: {
      success: boolean;
      statusCode?: number;
      durationMs?: number;
      errorCode?: string;
      errorMessage?: string;
      terminalStatus?: WebhookDeliveryStatus;
      retryAt?: Date;
    },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const data = outcome.success
        ? {
            status: WebhookDeliveryStatus.SUCCEEDED,
            deliveredAt: new Date(),
            lockedAt: null,
            lockToken: null,
            lastStatusCode: outcome.statusCode ?? null,
            lastError: null,
          }
        : outcome.terminalStatus
          ? {
              status: outcome.terminalStatus,
              lockedAt: null,
              lockToken: null,
              lastStatusCode: outcome.statusCode ?? null,
              lastError: outcome.errorMessage ?? "Webhook delivery failed.",
            }
          : {
              status: WebhookDeliveryStatus.PENDING,
              nextAttemptAt: outcome.retryAt ?? new Date(Date.now() + 1000),
              lockedAt: null,
              lockToken: null,
              lastStatusCode: outcome.statusCode ?? null,
              lastError: outcome.errorMessage ?? "Webhook delivery failed.",
            };

      // Fence the delivery first. A stale worker must not mutate even its attempt row.
      const updated = await tx.webhookDelivery.updateMany({
        where: { id: delivery.id, status: WebhookDeliveryStatus.PROCESSING, lockToken: delivery.lockToken },
        data,
      });
      if (updated.count !== 1) return;

      await tx.webhookDeliveryAttempt.updateMany({
        where: { deliveryId: delivery.id, attemptNumber: delivery.attempts, completedAt: null },
        data: {
          completedAt: new Date(),
          statusCode: outcome.statusCode ?? null,
          durationMs: outcome.durationMs ?? null,
          errorCode: outcome.errorCode ?? null,
          errorMessage: outcome.errorMessage ?? null,
        },
      });
    });
  }

  private sortJson(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((entry) => this.sortJson(entry));
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [
        key, this.sortJson((value as Record<string, unknown>)[key]),
      ]));
    }
    return value;
  }

  private retryDelay(attempt: number, base: number, max: number): number {
    const ceiling = Math.min(max, base * 2 ** Math.max(0, attempt - 1));
    return Math.floor(ceiling / 2 + Math.random() * ceiling / 2);
  }

  private safeErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : "Webhook delivery failed.";
    return message.replace(/[\r\n\t]+/g, " ").slice(0, 500) || "Webhook delivery failed.";
  }

  private integerOption(value: number | undefined, fallback: number, min: number, max: number): number {
    if (value === undefined) return fallback;
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new RangeError(`Option must be an integer between ${min} and ${max}.`);
    }
    return value;
  }
}
