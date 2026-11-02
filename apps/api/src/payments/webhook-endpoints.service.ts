import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createCipheriv, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateWebhookEndpointDto } from "./dto/create-webhook-endpoint.dto";
import { UpdateWebhookEndpointDto } from "./dto/update-webhook-endpoint.dto";

@Injectable()
export class WebhookEndpointsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(merchantId: string, dto: CreateWebhookEndpointDto) {
    this.assertSafeHttpsUrl(dto.url);
    const secret = "whsec_" + randomBytes(32).toString("base64url");
    const encrypted = this.encryptSecret(secret);
    const endpoint = await this.prisma.webhookEndpoint.create({
      data: { merchantId, url: dto.url, events: [...new Set(dto.events)], ...encrypted },
      select: { id: true, url: true, enabled: true, events: true, createdAt: true, updatedAt: true },
    });
    // Plaintext secret is returned once. It cannot be retrieved from the API later.
    return { ...endpoint, secret };
  }

  list(merchantId: string) {
    return this.prisma.webhookEndpoint.findMany({
      where: { merchantId },
      orderBy: { createdAt: "desc" },
      select: { id: true, url: true, enabled: true, events: true, createdAt: true, updatedAt: true },
    });
  }

  async update(merchantId: string, id: string, dto: UpdateWebhookEndpointDto) {
    if (dto.url !== undefined) this.assertSafeHttpsUrl(dto.url);
    const existing = await this.prisma.webhookEndpoint.findFirst({ where: { id, merchantId }, select: { id: true } });
    if (!existing) throw new NotFoundException("Webhook endpoint not found.");
    return this.prisma.webhookEndpoint.update({
      where: { id },
      data: { ...(dto.url !== undefined ? { url: dto.url } : {}), ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}), ...(dto.events !== undefined ? { events: [...new Set(dto.events)] } : {}) },
      select: { id: true, url: true, enabled: true, events: true, createdAt: true, updatedAt: true },
    });
  }

  async disable(merchantId: string, id: string) {
    const result = await this.prisma.webhookEndpoint.updateMany({
      where: { id, merchantId },
      data: { enabled: false },
    });
    if (result.count === 0) throw new NotFoundException("Webhook endpoint not found.");
    return { id, enabled: false };
  }

  private encryptSecret(secret: string) {
    const key = this.encryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    return {
      secretCiphertext: ciphertext.toString("base64"),
      secretIv: iv.toString("base64"),
      secretAuthTag: cipher.getAuthTag().toString("base64"),
      secretKeyVersion: 1,
    };
  }

  private encryptionKey(): Buffer {
    const raw = process.env.PAYFLOW_WEBHOOK_ENCRYPTION_KEY;
    if (!raw || !/^[a-fA-F0-9]{64}$/.test(raw)) {
      throw new Error("PAYFLOW_WEBHOOK_ENCRYPTION_KEY must be configured as 64 hexadecimal characters (32 bytes).");
    }
    return Buffer.from(raw, "hex");
  }

  private assertSafeHttpsUrl(value: string) {
    let url: URL;
    try { url = new URL(value); } catch { throw new BadRequestException("A valid HTTPS webhook URL is required."); }
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[") || !host.includes(".")) {
      throw new BadRequestException("Webhook URLs must use a public HTTPS hostname.");
    }
  }
}
