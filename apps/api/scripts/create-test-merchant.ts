import { PrismaClient, ApiKeyEnvironment } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
const prisma = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Test merchant generation is disabled in production.");
  const name = process.env.PAYFLOW_SEED_MERCHANT_NAME?.trim();
  const slug = process.env.PAYFLOW_SEED_MERCHANT_SLUG?.trim();
  if (!name || !slug) throw new Error("Set PAYFLOW_SEED_MERCHANT_NAME and PAYFLOW_SEED_MERCHANT_SLUG.");
  if (await prisma.merchant.findUnique({ where: { slug } })) throw new Error("Merchant slug already exists. Refusing to rotate credentials.");
  const keyPrefix = `pf_test_${randomBytes(5).toString("hex")}`;
  const apiKey = `${keyPrefix}_${randomBytes(32).toString("hex")}`;
  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  await prisma.merchant.create({
    data: { name, slug, apiKeys: { create: {
      name: "Local development key", keyPrefix, keyHash, environment: ApiKeyEnvironment.TEST,
      scopes: ["payment_intents:read", "payment_intents:write", "customers:read", "customers:write", "webhooks:read", "webhooks:write"],
    } } },
  });
  console.log("Merchant created:", slug);
  console.log("Copy this test API key now. It will not be displayed again:");
  console.log(apiKey);
  console.log("Treat it like a password. Never commit it or paste it into logs.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
