import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { Prisma, PaymentIntent } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePaymentIntentDto } from "./dto/create-payment-intent.dto";
import { ListPaymentIntentsDto } from "./dto/list-payment-intents.dto";

@Injectable()
export class PaymentIntentsService {
  constructor(private readonly prisma: PrismaService) {}
  private serialize(payment: PaymentIntent) {
    return {
      id: payment.id, object: "payment_intent", amount: payment.amount.toString(),
      currency: payment.currency, status: payment.status.toLowerCase(),
      customer: payment.customerId, description: payment.description, metadata: payment.metadata,
      createdAt: payment.createdAt.toISOString(), updatedAt: payment.updatedAt.toISOString(),
    };
  }

  async create(merchantId: string, idempotencyKey: string, dto: CreatePaymentIntentDto) {
    if (!/^[A-Za-z0-9._:-]{8,255}$/.test(idempotencyKey)) {
      throw new UnprocessableEntityException("Idempotency-Key must be 8-255 safe characters.");
    }
    const requestHash = createHash("sha256").update(JSON.stringify({
      amount: dto.amount, currency: dto.currency, customerId: dto.customerId ?? null,
      description: dto.description ?? null, metadata: dto.metadata ?? null,
    })).digest("hex");

    try {
      const payment = await this.prisma.$transaction(async (tx) => {
        if (dto.customerId) {
          const customer = await tx.customer.findFirst({
            where: { id: dto.customerId, merchantId }, select: { id: true },
          });
          if (!customer) throw new NotFoundException("Customer not found for this merchant.");
        }
        await tx.idempotencyRecord.create({ data: { merchantId, key: idempotencyKey, requestHash } });
        const created = await tx.paymentIntent.create({
          data: {
            merchantId, customerId: dto.customerId, amount: BigInt(dto.amount), currency: dto.currency,
            description: dto.description,
            metadata: dto.metadata as Prisma.InputJsonValue | undefined,
          },
        });
        await tx.idempotencyRecord.update({
          where: { merchantId_key: { merchantId, key: idempotencyKey } },
          data: { responseStatus: 201, responseBody: this.serialize(created) as Prisma.InputJsonValue },
        });
        return created;
      });
      return { data: this.serialize(payment), idempotentReplay: false };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const prior = await this.prisma.idempotencyRecord.findUnique({
          where: { merchantId_key: { merchantId, key: idempotencyKey } },
        });
        if (prior) {
          if (prior.requestHash !== requestHash) {
            throw new ConflictException("This idempotency key was already used with a different request.");
          }
          if (prior.responseBody) return { data: prior.responseBody, idempotentReplay: true };
        }
      }
      throw error;
    }
  }

  async list(merchantId: string, query: ListPaymentIntentsDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where = { merchantId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.paymentIntent.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      this.prisma.paymentIntent.count({ where }),
    ]);
    return { data: items.map((item) => this.serialize(item)), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async get(merchantId: string, id: string) {
    const payment = await this.prisma.paymentIntent.findFirst({ where: { id, merchantId } });
    if (!payment) throw new NotFoundException("Payment intent not found.");
    return { data: this.serialize(payment) };
  }
}
