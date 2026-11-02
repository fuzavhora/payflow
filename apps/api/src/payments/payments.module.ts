import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PaymentIntentsController } from "./payment-intents.controller";
import { PaymentIntentsService } from "./payment-intents.service";
@Module({ imports: [AuthModule], controllers: [PaymentIntentsController], providers: [PaymentIntentsService] })
export class PaymentsModule {}
