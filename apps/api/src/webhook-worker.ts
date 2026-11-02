import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { WebhookDeliveryWorkerService } from "./payments/webhook-delivery-worker.service";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });
  const worker = app.get(WebhookDeliveryWorkerService);
  const pollIntervalMs = Number(process.env.WEBHOOK_WORKER_POLL_INTERVAL_MS ?? 1000);
  if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 250 || pollIntervalMs > 60000) {
    await app.close();
    throw new Error("WEBHOOK_WORKER_POLL_INTERVAL_MS must be an integer between 250 and 60000.");
  }

  let stopping = false;
  process.once("SIGINT", () => { stopping = true; });
  process.once("SIGTERM", () => { stopping = true; });

  console.log("PayFlow webhook worker started.");
  while (!stopping) {
    try {
      await worker.runOnce();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown worker error.";
      console.error("Webhook worker iteration failed:", message);
    }
    if (!stopping) await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  await app.close();
  console.log("PayFlow webhook worker stopped.");
}

void bootstrap();
