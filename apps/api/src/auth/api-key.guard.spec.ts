import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { ApiKeyEnvironment } from "@prisma/client";
import { createHash } from "node:crypto";
import { ApiKeyGuard } from "./api-key.guard";

function makeContext(rawKey: string) {
  const request: Record<string, unknown> = { headers: { authorization: `Bearer ${rawKey}` } };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => "handler",
    getClass: () => "controller",
  };
  return { context: context as never, request };
}

describe("ApiKeyGuard", () => {
  const secret = "a".repeat(64);
  const key = `pf_test_1234567890_${secret}`;
  const record = {
    id: "key_1", merchantId: "merchant_1",
    keyHash: createHash("sha256").update(key).digest("hex"),
    environment: ApiKeyEnvironment.TEST, scopes: ["payment_intents:read", "payment_intents:write"],
    revokedAt: null, expiresAt: null,
  };

  it("authenticates key and attaches server-resolved merchant context", async () => {
    const prisma = { apiKey: { findUnique: jest.fn().mockResolvedValue(record), update: jest.fn().mockResolvedValue({}) } };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["payment_intents:read"]) };
    const { context, request } = makeContext(key);
    const guard = new ApiKeyGuard(prisma as never, reflector as never);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.merchantId).toBe("merchant_1");
    expect(prisma.apiKey.update).toHaveBeenCalledTimes(1);
  });

  it("rejects a key without the required scope", async () => {
    const prisma = { apiKey: { findUnique: jest.fn().mockResolvedValue({ ...record, scopes: [] }), update: jest.fn() } };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["payment_intents:read"]) };
    const { context } = makeContext(key);
    const guard = new ApiKeyGuard(prisma as never, reflector as never);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects a key with an invalid secret", async () => {
    const prisma = { apiKey: { findUnique: jest.fn().mockResolvedValue(record), update: jest.fn() } };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([]) };
    const { context } = makeContext(`pf_test_1234567890_${"b".repeat(64)}`);
    const guard = new ApiKeyGuard(prisma as never, reflector as never);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
