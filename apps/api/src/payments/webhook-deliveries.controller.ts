import { Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
import { ApiKeyGuard } from "../auth/api-key.guard";
import { RequireScopes } from "../auth/require-scopes.decorator";
import { MerchantRequest } from "../common/merchant-request";
import { WebhookDeliveryService } from "./webhook-delivery.service";

@Controller("webhook-deliveries")
@UseGuards(ApiKeyGuard)
export class WebhookDeliveriesController {
  constructor(private readonly deliveries: WebhookDeliveryService) {}

  @Get()
  @RequireScopes("webhooks:read")
  list(@Req() request: MerchantRequest, @Query("take") take?: string) {
    const parsed = take === undefined ? 50 : Number(take);
    return this.deliveries.listDeliveries(request.merchantId, Number.isInteger(parsed) ? parsed : 50);
  }

  @Get(":id")
  @RequireScopes("webhooks:read")
  get(@Req() request: MerchantRequest, @Param("id") id: string) {
    return this.deliveries.getDelivery(request.merchantId, id);
  }
}
