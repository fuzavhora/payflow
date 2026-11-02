import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}
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
      select: { id: true, merchantId: true, keyHash: true, revokedAt: true, expiresAt: true },
    });
    if (!record || record.revokedAt || (record.expiresAt && record.expiresAt <= new Date())) {
      throw new UnauthorizedException("The API key is invalid or revoked.");
    }
    const suppliedHash = createHash("sha256").update(rawKey).digest();
    const storedHash = Buffer.from(record.keyHash, "hex");
    if (suppliedHash.length !== storedHash.length || !timingSafeEqual(suppliedHash, storedHash)) {
      throw new UnauthorizedException("The API key is invalid or revoked.");
    }
    request.merchantId = record.merchantId;
    request.apiKeyId = record.id;
    await this.prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
    return true;
  }
}
