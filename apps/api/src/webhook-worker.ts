import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { WebhookDeliveryWorkerService } from "./payments/webhook-delivery-worker.service";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });

  try {
    const worker = app.get(WebhookDeliveryWorkerService);
    const pollIntervalMs = Number(process.env.WEBHOOK_WORKER_POLL_INTERVAL_MS ?? 1000);
    if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 250 || pollIntervalMs > 60000) {
      throw new Error("WEBHOOK_WORKER_POLL_INTERVAL_MS must be an integer between 250 and 60000.");
    }

    let stopping = false;
    let wakeCurrentSleep: (() => void) | undefined;
    const requestStop = (signal: string) => {
      if (stopping) return;
      stopping = true;
      console.log(`Received ${signal}; draining the active webhook iteration before shutdown.`);
      wakeCurrentSleep?.();
    };
    process.once("SIGINT", () => requestStop("SIGINT"));
    process.once("SIGTERM", () => requestStop("SIGTERM"));

    console.log("PayFlow webhook worker started.");
    while (!stopping) {
      try {
        // runOnce waits for every claimed delivery in each wave to settle before returning.
        await worker.runOnce();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown worker error.";
        console.error("Webhook worker iteration failed:", message);
      }

      if (!stopping) {
        await new Promise<void>((resolve) => {
          let timer: NodeJS.Timeout;
          const finishSleep = () => {
            clearTimeout(timer);
            if (wakeCurrentSleep === finishSleep) wakeCurrentSleep = undefined;
            resolve();
          };
          timer = setTimeout(finishSleep, pollIntervalMs);
          wakeCurrentSleep = finishSleep;
        });
      }
    }
    console.log("PayFlow webhook worker stopped.");
  } finally {
    await app.close();
  }
}

void bootstrap();
