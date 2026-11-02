import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiKeyEnvironment } from "@prisma/client";
import { createHash, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { REQUIRED_SCOPES } from "./require-scopes.decorator";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService, private readonly reflector: Reflector) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;
    if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
      throw new UnauthorizedException("A PayFlow API key is required.");
    }
    const rawKey = authorization.slice(7).trim();
    const parts = rawKey.split("_");
    if (parts.length !== 4 || parts[0] !== "pf" || !["test", "live"].includes(parts[1])) {
      throw new UnauthorizedException("The API key is invalid or revoked.");
    }
    const keyPrefix = parts.slice(0, 3).join("_");
    const record = await this.prisma.apiKey.findUnique({
      where: { keyPrefix },
      select: { id: true, merchantId: true, keyHash: true, environment: true, scopes: true, revokedAt: true, expiresAt: true },
    });
    if (!record || record.revokedAt || (record.expiresAt && record.expiresAt <= new Date())) {
      throw new UnauthorizedException("The API key is invalid or revoked.");
    }
    const expectedEnvironment = parts[1] === "test" ? ApiKeyEnvironment.TEST : ApiKeyEnvironment.LIVE;
    if (record.environment !== expectedEnvironment) throw new UnauthorizedException("The API key environment is invalid.");

    const suppliedHash = createHash("sha256").update(rawKey).digest();
    const storedHash = Buffer.from(record.keyHash, "hex");
    if (suppliedHash.length !== storedHash.length || !timingSafeEqual(suppliedHash, storedHash)) {
      throw new UnauthorizedException("The API key is invalid or revoked.");
    }

    const requiredScopes = this.reflector.getAllAndOverride<string[]>(REQUIRED_SCOPES, [
      context.getHandler(), context.getClass(),
    ]) ?? [];
    if (!requiredScopes.every((scope) => record.scopes.includes(scope))) {
      throw new ForbiddenException("The API key does not have the required scope.");
    }

    request.merchantId = record.merchantId;
    request.apiKeyId = record.id;
    request.apiKeyScopes = record.scopes;
    await this.prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
    return true;
  }
}
