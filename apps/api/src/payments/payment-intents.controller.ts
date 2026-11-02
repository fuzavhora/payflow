import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiKeyGuard } from "../auth/api-key.guard";
import { RequireScopes } from "../auth/require-scopes.decorator";
import { MerchantRequest } from "../common/merchant-request";
import { CreatePaymentIntentDto } from "./dto/create-payment-intent.dto";
import { ListPaymentIntentsDto } from "./dto/list-payment-intents.dto";
import { PaymentIntentsService } from "./payment-intents.service";
@Controller("payment-intents")
@UseGuards(ApiKeyGuard)
export class PaymentIntentsController {
  constructor(private readonly payments: PaymentIntentsService) {}
  @Post()
  @RequireScopes("payment_intents:write")
  create(@Req() request: MerchantRequest, @Headers("idempotency-key") key: string, @Body() dto: CreatePaymentIntentDto) {
    return this.payments.create(request.merchantId, key ?? "", dto);
  }
  @Get()
  @RequireScopes("payment_intents:read")
  list(@Req() request: MerchantRequest, @Query() query: ListPaymentIntentsDto) {
    return this.payments.list(request.merchantId, query);
  }
  @Get(":id")
  @RequireScopes("payment_intents:read")
  get(@Req() request: MerchantRequest, @Param("id") id: string) {
    return this.payments.get(request.merchantId, id);
  }
}
