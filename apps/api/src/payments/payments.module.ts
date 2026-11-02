import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PaymentAttemptService } from "./payment-attempt.service";
import { OutboxDispatcherService } from "./outbox-dispatcher.service";
import { PaymentIntentTransitionService } from "./payment-intent-transition.service";
import { PaymentIntentsController } from "./payment-intents.controller";
import { PaymentIntentsService } from "./payment-intents.service";

@Module({
  imports: [AuthModule],
  controllers: [PaymentIntentsController],
  providers: [PaymentIntentsService, PaymentIntentTransitionService, PaymentAttemptService, OutboxDispatcherService],
  exports: [PaymentIntentTransitionService, PaymentAttemptService, OutboxDispatcherService],
})
export class PaymentsModule {}
