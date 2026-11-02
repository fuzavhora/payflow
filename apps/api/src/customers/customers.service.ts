import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { ListCustomersDto } from "./dto/list-customers.dto";

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}
  private serialize(customer: { id: string; email: string; name: string | null; metadata: Prisma.JsonValue | null; createdAt: Date; updatedAt: Date }) {
    return {
      id: customer.id, object: "customer", email: customer.email, name: customer.name,
      metadata: customer.metadata, createdAt: customer.createdAt.toISOString(), updatedAt: customer.updatedAt.toISOString(),
    };
  }

  async create(merchantId: string, dto: CreateCustomerDto) {
    try {
      const customer = await this.prisma.customer.create({
        data: {
          merchantId, email: dto.email.trim().toLowerCase(), name: dto.name?.trim(),
          metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        },
      });
      return { data: this.serialize(customer) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("A customer with this email already exists for this merchant.");
      }
      throw error;
    }
  }

  async list(merchantId: string, query: ListCustomersDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where = { merchantId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      this.prisma.customer.count({ where }),
    ]);
    return {
      data: items.map((item) => this.serialize(item)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async get(merchantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, merchantId } });
    if (!customer) throw new NotFoundException("Customer not found.");
    return { data: this.serialize(customer) };
  }
}
