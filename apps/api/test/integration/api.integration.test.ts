import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { createHash, randomBytes } from "node:crypto";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/prisma/prisma.service";

describe("PayFlow API integration (PostgreSQL)", () => {
  let app: Awaited<ReturnType<typeof NestFactory.create>>;
  let prisma: PrismaService;
  let baseUrl: string;
  let merchantA: string;
  let merchantB: string;
  let keyA: string;
  let keyB: string;
  let readOnlyKey: string;

  async function createApiKey(merchantId: string, scopes: string[]) {
    const prefix = randomBytes(6).toString("hex");
    const rawKey = `pf_test_${prefix}_${randomBytes(24).toString("hex")}`;
    await prisma.apiKey.create({
      data: {
        merchantId, name: "integration test", keyPrefix: `pf_test_${prefix}`,
        keyHash: createHash("sha256").update(rawKey).digest("hex"),
        environment: "TEST", scopes,
      },
    });
    return rawKey;
  }

  async function request(path: string, options: RequestInit = {}, key?: string) {
    const headers = new Headers(options.headers);
    if (key) headers.set("Authorization", `Bearer ${key}`);
    if (options.body) headers.set("Content-Type", "application/json");
    return fetch(`${baseUrl}/api/v1${path}`, { ...options, headers });
  }

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for API integration tests.");
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, "127.0.0.1");
    const address = app.getHttpServer().address();
    if (!address || typeof address === "string") throw new Error("Could not determine integration test server port.");
    baseUrl = `http://127.0.0.1:${address.port}`;
    prisma = app.get(PrismaService);

    const suffix = randomBytes(8).toString("hex");
    const first = await prisma.merchant.create({ data: { name: "Integration Merchant A", slug: `integration-a-${suffix}` } });
    const second = await prisma.merchant.create({ data: { name: "Integration Merchant B", slug: `integration-b-${suffix}` } });
    merchantA = first.id;
    merchantB = second.id;
    const fullScopes = ["customers:read", "customers:write", "payment_intents:read", "payment_intents:write"];
    keyA = await createApiKey(merchantA, fullScopes);
    keyB = await createApiKey(merchantB, fullScopes);
    readOnlyKey = await createApiKey(merchantA, ["customers:read"]);
  });

  afterAll(async () => {
    if (prisma && merchantA && merchantB) {
      const merchantIds = [merchantA, merchantB];
      await prisma.paymentIntent.deleteMany({ where: { merchantId: { in: merchantIds } } });
      await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
    }
    if (app) await app.close();
  });

  it("exposes a live database health check", async () => {
    const response = await request("/health");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "ok", service: "payflow-api", dependencies: { database: "ok" } });
  });

  it("rejects missing, malformed and insufficiently scoped API keys", async () => {
    expect((await request("/customers")).status).toBe(401);
    expect((await request("/customers", {}, "not-a-payflow-key")).status).toBe(401);
    expect((await request("/customers", { method: "POST", body: JSON.stringify({ email: "blocked@example.com" }) }, readOnlyKey)).status).toBe(403);
  });

  it("normalizes customer email, rejects duplicates and enforces tenant isolation", async () => {
    const created = await request("/customers", { method: "POST", body: JSON.stringify({ email: "  BUYER@Example.com  ", name: "Buyer" }) }, keyA);
    expect(created.status).toBe(201);
    const body = await created.json() as { data: { id: string; email: string } };
    expect(body.data.email).toBe("buyer@example.com");

    const duplicate = await request("/customers", { method: "POST", body: JSON.stringify({ email: "buyer@example.com" }) }, keyA);
    expect(duplicate.status).toBe(409);
    expect((await request(`/customers/${body.data.id}`, {}, keyB)).status).toBe(404);

    const listA = await request("/customers", {}, keyA);
    const listBody = await listA.json() as { data: Array<{ id: string }> };
    expect(listBody.data.map((item) => item.id)).toContain(body.data.id);
    const listB = await request("/customers", {}, keyB);
    const listBBody = await listB.json() as { data: Array<{ id: string }> };
    expect(listBBody.data).toHaveLength(0);
  });

  it("creates PaymentIntents, replays idempotently and rejects key reuse with changed input", async () => {
    const customerResponse = await request("/customers", { method: "POST", body: JSON.stringify({ email: "payments@example.com" }) }, keyA);
    const customer = await customerResponse.json() as { data: { id: string } };
    const payload = { amount: 2599, currency: "USD", customerId: customer.data.id, metadata: { order: "order_1", nested: { b: 2, a: 1 } } };

    const created = await request("/payment-intents", {
      method: "POST", headers: { "Idempotency-Key": "integration-order-0001" }, body: JSON.stringify(payload),
    }, keyA);
    expect(created.status).toBe(201);
    const createdBody = await created.json() as { data: { id: string; amount: string; status: string }; idempotentReplay: boolean };
    expect(createdBody.data.amount).toBe("2599");
    expect(createdBody.data.status).toBe("requires_payment_method");
    expect(createdBody.idempotentReplay).toBe(false);

    const replay = await request("/payment-intents", {
      method: "POST", headers: { "Idempotency-Key": "integration-order-0001" },
      body: JSON.stringify({ ...payload, metadata: { nested: { a: 1, b: 2 }, order: "order_1" } }),
    }, keyA);
    expect(replay.status).toBe(201);
    expect((await replay.json() as { idempotentReplay: boolean }).idempotentReplay).toBe(true);

    const conflict = await request("/payment-intents", {
      method: "POST", headers: { "Idempotency-Key": "integration-order-0001" },
      body: JSON.stringify({ ...payload, amount: 2600 }),
    }, keyA);
    expect(conflict.status).toBe(409);
    expect((await request(`/payment-intents/${createdBody.data.id}`, {}, keyB)).status).toBe(404);
  });

  it("rejects invalid DTOs and missing idempotency keys at the HTTP boundary", async () => {
    const invalid = await request("/payment-intents", {
      method: "POST", headers: { "Idempotency-Key": "integration-invalid-0001" },
      body: JSON.stringify({ amount: -1, currency: "usd", unexpected: true }),
    }, keyA);
    expect(invalid.status).toBe(400);

    const missingKey = await request("/payment-intents", {
      method: "POST", body: JSON.stringify({ amount: 100, currency: "USD" }),
    }, keyA);
    expect(missingKey.status).toBe(422);
  });
});
