import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OutboxDispatcherService } from "./outbox-dispatcher.service";
import { PaymentAttemptService } from "./payment-attempt.service";
import { PaymentIntentTransitionService } from "./payment-intent-transition.service";
import { PaymentIntentsController } from "./payment-intents.controller";
import { PaymentIntentsService } from "./payment-intents.service";
import { WebhookEndpointsController } from "./webhook-endpoints.controller";
import { WebhookEndpointsService } from "./webhook-endpoints.service";
import { WebhookSignatureService } from "./webhook-signature.service";
import { WebhookDeliveryService } from "./webhook-delivery.service";
import { WebhookDeliveriesController } from "./webhook-deliveries.controller";
import { SecureWebhookHttpTransport } from "./secure-webhook-http-transport.service";

@Module({
  imports: [AuthModule],
  controllers: [PaymentIntentsController, WebhookEndpointsController, WebhookDeliveriesController],
  providers: [PaymentIntentsService, PaymentIntentTransitionService, PaymentAttemptService, OutboxDispatcherService, WebhookEndpointsService, WebhookSignatureService, WebhookDeliveryService, SecureWebhookHttpTransport],
  exports: [PaymentIntentTransitionService, PaymentAttemptService, OutboxDispatcherService, WebhookEndpointsService, WebhookSignatureService],
})
export class PaymentsModule {}
