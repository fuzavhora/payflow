import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { HealthModule } from "./health/health.module";
import { PaymentsModule } from "./payments/payments.module";
import { PrismaModule } from "./prisma/prisma.module";
@Module({ imports: [PrismaModule, AuthModule, HealthModule, PaymentsModule] })
export class AppModule {}
