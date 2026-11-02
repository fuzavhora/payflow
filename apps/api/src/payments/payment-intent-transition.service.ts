import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { PaymentIntentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  assertPaymentIntentTransition,
  InvalidPaymentIntentTransitionError,
} from "./domain/payment-intent-state-machine";

/**
 * Internal application service for trusted payment orchestration components.
 * Deliberately not exposed as a merchant-facing status mutation endpoint.
 */
@Injectable()
export class PaymentIntentTransitionService {
  constructor(private readonly prisma: PrismaService) {}

  async transition(
    merchantId: string,
    paymentIntentId: string,
    targetStatus: PaymentIntentStatus,
  ) {
    const current = await this.prisma.paymentIntent.findFirst({
      where: { id: paymentIntentId, merchantId },
      select: { id: true, status: true },
    });

    if (!current) {
      throw new NotFoundException("Payment intent not found.");
    }

    try {
      assertPaymentIntentTransition(current.status, targetStatus);
    } catch (error) {
      if (error instanceof InvalidPaymentIntentTransitionError) {
        throw new UnprocessableEntityException(error.message);
      }
      throw error;
    }

    // Compare-and-swap: only one worker can move this intent from the
    // observed source state. Never perform provider I/O in this operation.
    const result = await this.prisma.paymentIntent.updateMany({
      where: {
        id: paymentIntentId,
        merchantId,
        status: current.status,
      },
      data: { status: targetStatus },
    });

    if (result.count !== 1) {
      throw new ConflictException(
        "Payment intent changed concurrently; retrieve the latest state before retrying.",
      );
    }

    const updated = await this.prisma.paymentIntent.findFirst({
      where: { id: paymentIntentId, merchantId },
    });

    if (!updated) {
      // Defensive: the row should not disappear because of the restrictive
      // payment relation and the scoped conditional update.
      throw new NotFoundException("Payment intent not found after transition.");
    }

    return { data: updated };
  }
}
