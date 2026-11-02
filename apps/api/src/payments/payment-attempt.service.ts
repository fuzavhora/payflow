import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { PaymentAttemptStatus, PaymentIntentStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ProviderPaymentResult } from "./providers/payment-provider.contract";
import {
  assertPaymentIntentTransition,
  InvalidPaymentIntentTransitionError,
} from "./domain/payment-intent-state-machine";

/**
 * Internal persistence boundary for provider attempts.
 *
 * Provider network calls must happen outside these database transactions:
 * beginAttempt() commits PROCESSING + CREATED before execution; recordResult()
 * records the normalized result afterwards.
 */
@Injectable()
export class PaymentAttemptService {
  constructor(private readonly prisma: PrismaService) {}

  async beginAttempt(merchantId: string, paymentIntentId: string, provider: string) {
    if (!/^[a-z][a-z0-9_-]{1,49}$/.test(provider)) {
      throw new UnprocessableEntityException("Provider name must be a normalized identifier.");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const intent = await tx.paymentIntent.findFirst({
          where: { id: paymentIntentId, merchantId },
          select: { id: true, status: true },
        });
        if (!intent) throw new NotFoundException("Payment intent not found.");

        try {
          assertPaymentIntentTransition(intent.status, PaymentIntentStatus.PROCESSING);
        } catch (error) {
          if (error instanceof InvalidPaymentIntentTransitionError) {
            throw new UnprocessableEntityException(error.message);
          }
          throw error;
        }

        const changed = await tx.paymentIntent.updateMany({
          where: { id: paymentIntentId, merchantId, status: intent.status },
          data: { status: PaymentIntentStatus.PROCESSING },
        });
        if (changed.count !== 1) {
          throw new ConflictException("Payment intent changed concurrently; retrieve its latest state.");
        }

        return tx.paymentAttempt.create({
          data: { paymentIntentId, provider, status: PaymentAttemptStatus.CREATED },
        });
      });
    } catch (error) {
      throw error;
    }
  }

  async recordResult(merchantId: string, attemptId: string, result: ProviderPaymentResult) {
    if (!result.providerReference || result.providerReference.length > 255) {
      throw new UnprocessableEntityException("Provider result must include a valid provider reference.");
    }

    return this.prisma.$transaction(async (tx) => {
      const attempt = await tx.paymentAttempt.findFirst({
        where: { id: attemptId, provider: result.provider, paymentIntent: { merchantId } },
        include: { paymentIntent: { select: { id: true, status: true } } },
      });
      if (!attempt) throw new NotFoundException("Payment attempt not found.");

      if (attempt.status !== PaymentAttemptStatus.CREATED && attempt.status !== PaymentAttemptStatus.PENDING) {
        throw new ConflictException("Payment attempt is already terminal.");
      }
      if (attempt.paymentIntent.status !== PaymentIntentStatus.PROCESSING) {
        throw new ConflictException("Payment intent is no longer processing.");
      }

      if (result.status === "requires_action") {
        // The current schema has no explicit REQUIRES_ACTION state or secure
        // customer-action lifecycle. Do not silently misrepresent this result.
        throw new UnprocessableEntityException("Provider requires customer action; this flow is not implemented yet.");
      }

      const attemptStatus = result.status === "succeeded"
        ? PaymentAttemptStatus.SUCCEEDED
        : result.status === "failed"
          ? PaymentAttemptStatus.FAILED
          : PaymentAttemptStatus.PENDING;

      const terminalIntentStatus = result.status === "succeeded"
        ? PaymentIntentStatus.SUCCEEDED
        : result.status === "failed"
          ? PaymentIntentStatus.FAILED
          : null;

      const attemptUpdate = await tx.paymentAttempt.updateMany({
        where: {
          id: attemptId,
          status: { in: [PaymentAttemptStatus.CREATED, PaymentAttemptStatus.PENDING] },
        },
        data: {
          status: attemptStatus,
          providerReference: result.providerReference,
          failureCode: result.failureCode ?? null,
          failureMessage: result.failureMessage ?? null,
        },
      });
      if (attemptUpdate.count !== 1) {
        throw new ConflictException("Payment attempt changed concurrently.");
      }

      if (terminalIntentStatus) {
        try {
          assertPaymentIntentTransition(attempt.paymentIntent.status, terminalIntentStatus);
        } catch (error) {
          if (error instanceof InvalidPaymentIntentTransitionError) {
            throw new ConflictException(error.message);
          }
          throw error;
        }
        const intentUpdate = await tx.paymentIntent.updateMany({
          where: {
            id: attempt.paymentIntent.id,
            merchantId,
            status: PaymentIntentStatus.PROCESSING,
          },
          data: { status: terminalIntentStatus },
        });
        if (intentUpdate.count !== 1) {
          throw new ConflictException("Payment intent changed concurrently.");
        }
      }

      return tx.paymentAttempt.findUnique({ where: { id: attemptId } });
    });
  }

  /**
   * A timeout is an unknown provider outcome, not a definitive failure.
   * Keep the intent PROCESSING and mark the attempt PENDING for reconciliation.
   */
  async recordUnknownOutcome(merchantId: string, attemptId: string) {
    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: { id: attemptId, paymentIntent: { merchantId } },
      select: { id: true, status: true },
    });
    if (!attempt) throw new NotFoundException("Payment attempt not found.");
    if (attempt.status !== PaymentAttemptStatus.CREATED && attempt.status !== PaymentAttemptStatus.PENDING) {
      throw new ConflictException("Payment attempt is already terminal.");
    }

    const updated = await this.prisma.paymentAttempt.updateMany({
      where: { id: attemptId, status: { in: [PaymentAttemptStatus.CREATED, PaymentAttemptStatus.PENDING] } },
      data: { status: PaymentAttemptStatus.PENDING },
    });
    if (updated.count !== 1) throw new ConflictException("Payment attempt changed concurrently.");

    return this.prisma.paymentAttempt.findUnique({ where: { id: attemptId } });
  }
}
