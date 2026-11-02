import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiKeyGuard } from "../auth/api-key.guard";
import { RequireScopes } from "../auth/require-scopes.decorator";
import { MerchantRequest } from "../common/merchant-request";
import { CreateWebhookEndpointDto } from "./dto/create-webhook-endpoint.dto";
import { UpdateWebhookEndpointDto } from "./dto/update-webhook-endpoint.dto";
import { WebhookEndpointsService } from "./webhook-endpoints.service";

@Controller("webhook-endpoints")
@UseGuards(ApiKeyGuard)
export class WebhookEndpointsController {
  constructor(private readonly webhooks: WebhookEndpointsService) {}

  @Post()
  @RequireScopes("webhooks:write")
  create(@Req() request: MerchantRequest, @Body() dto: CreateWebhookEndpointDto) {
    return this.webhooks.create(request.merchantId, dto);
  }

  @Get()
  @RequireScopes("webhooks:read")
  list(@Req() request: MerchantRequest) {
    return this.webhooks.list(request.merchantId);
  }

  @Patch(":id")
  @RequireScopes("webhooks:write")
  update(@Req() request: MerchantRequest, @Param("id") id: string, @Body() dto: UpdateWebhookEndpointDto) {
    return this.webhooks.update(request.merchantId, id, dto);
  }

  @Post(":id/rotate-secret")
  @RequireScopes("webhooks:write")
  rotateSecret(@Req() request: MerchantRequest, @Param("id") id: string) {
    return this.webhooks.rotateSecret(request.merchantId, id);
  }

  @Delete(":id")
  @RequireScopes("webhooks:write")
  disable(@Req() request: MerchantRequest, @Param("id") id: string) {
    return this.webhooks.disable(request.merchantId, id);
  }
}
