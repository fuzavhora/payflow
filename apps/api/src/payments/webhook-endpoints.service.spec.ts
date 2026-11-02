import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { WebhookEndpointsService } from "./webhook-endpoints.service";
import { PrismaService } from "../prisma/prisma.service";

describe("WebhookEndpointsService", () => {
  let service: WebhookEndpointsService;
  let prisma: {
    $transaction: jest.Mock;
    webhookEndpoint: {
      create: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock;
      update: jest.Mock; updateMany: jest.Mock;
    };
  };
  const endpoint = {
    id: "wh_1", url: "https://hooks.example.com/payflow", enabled: true,
    events: ["payment_intent.succeeded"], createdAt: new Date(), updatedAt: new Date(),
  };

  beforeEach(() => {
    process.env.PAYFLOW_WEBHOOK_ENCRYPTION_KEY = "a".repeat(64);
    prisma = {
      $transaction: jest.fn(),
      webhookEndpoint: {
        create: jest.fn().mockResolvedValue(endpoint),
        findMany: jest.fn().mockResolvedValue([endpoint]),
        findFirst: jest.fn().mockResolvedValue({ id: endpoint.id }),
        update: jest.fn().mockResolvedValue(endpoint),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    service = new WebhookEndpointsService(prisma as unknown as PrismaService);
  });

  afterAll(() => { delete process.env.PAYFLOW_WEBHOOK_ENCRYPTION_KEY; });

  it("creates a merchant-owned endpoint and returns its secret only once", async () => {
    const result = await service.create("merchant_1", {
      url: endpoint.url, events: ["payment_intent.succeeded", "payment_intent.succeeded"],
    });
    const data = prisma.webhookEndpoint.create.mock.calls[0][0].data;
    expect(data.merchantId).toBe("merchant_1");
    expect(data.events).toEqual(["payment_intent.succeeded"]);
    expect(data.secretCiphertext).not.toContain(result.secret);
    expect(data.secretIv).toBeDefined();
    expect(data.secretAuthTag).toBeDefined();
    expect(result.secret).toMatch(/^whsec_/);
  });

  it("never returns encrypted or plaintext secrets from list", async () => {
    const result = await service.list("merchant_1");
    expect(prisma.webhookEndpoint.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { merchantId: "merchant_1" } }));
    expect(result[0]).not.toHaveProperty("secretCiphertext");
    expect(result[0]).not.toHaveProperty("secret");
  });

  it("scopes endpoint disable to the authenticated merchant", async () => {
    await service.disable("merchant_1", "wh_1");
    expect(prisma.webhookEndpoint.updateMany).toHaveBeenCalledWith({
      where: { id: "wh_1", merchantId: "merchant_1" }, data: { enabled: false },
    });
  });

  it("rejects non-HTTPS and local destinations", async () => {
    await expect(service.create("merchant_1", { url: "http://hooks.example.com", events: ["payment_intent.succeeded"] })).rejects.toThrow(BadRequestException);
    await expect(service.create("merchant_1", { url: "https://localhost/hook", events: ["payment_intent.succeeded"] })).rejects.toThrow(BadRequestException);
    expect(prisma.webhookEndpoint.create).not.toHaveBeenCalled();
  });

  it("requires a 32-byte encryption key", async () => {
    process.env.PAYFLOW_WEBHOOK_ENCRYPTION_KEY = "invalid";
    await expect(service.create("merchant_1", { url: endpoint.url, events: ["payment_intent.succeeded"] })).rejects.toThrow("PAYFLOW_WEBHOOK_ENCRYPTION_KEY");
  });

  it("rotates the signing secret and retains the previous encrypted secret during grace", async () => {
    const tx = {
      webhookEndpoint: {
        findFirst: jest.fn().mockResolvedValue({
          secretCiphertext: "old-ciphertext", secretIv: "old-iv", secretAuthTag: "old-tag",
          secretKeyVersion: 1, previousSecretExpiresAt: null,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    const result = await service.rotateSecret("merchant_1", "wh_1", 3600);
    const update = tx.webhookEndpoint.updateMany.mock.calls[0][0];
    expect(update.where).toEqual({ id: "wh_1", merchantId: "merchant_1", secretCiphertext: "old-ciphertext" });
    expect(update.data.previousSecretCiphertext).toBe("old-ciphertext");
    expect(update.data.previousSecretIv).toBe("old-iv");
    expect(update.data.previousSecretAuthTag).toBe("old-tag");
    expect(update.data.secretCiphertext).not.toBe("old-ciphertext");
    expect(result.secret).toMatch(/^whsec_/);
    expect(result.previousSecretExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("prevents another rotation while the previous secret grace period is active", async () => {
    const tx = { webhookEndpoint: { findFirst: jest.fn().mockResolvedValue({
      secretCiphertext: "current", secretIv: "iv", secretAuthTag: "tag",
      secretKeyVersion: 1, previousSecretExpiresAt: new Date(Date.now() + 60000),
    }), updateMany: jest.fn() } };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    await expect(service.rotateSecret("merchant_1", "wh_1")).rejects.toThrow(ConflictException);
    expect(tx.webhookEndpoint.updateMany).not.toHaveBeenCalled();
  });

  it("validates secret rotation grace period", async () => {
    await expect(service.rotateSecret("merchant_1", "wh_1", 30)).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns not found for an endpoint outside the merchant", async () => {
    const tx = { webhookEndpoint: { findFirst: jest.fn().mockResolvedValue(null), updateMany: jest.fn() } };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    await expect(service.rotateSecret("merchant_1", "foreign")).rejects.toThrow(NotFoundException);
  });
});
