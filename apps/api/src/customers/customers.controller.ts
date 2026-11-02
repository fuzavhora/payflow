import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiKeyGuard } from "../auth/api-key.guard";
import { RequireScopes } from "../auth/require-scopes.decorator";
import { MerchantRequest } from "../common/merchant-request";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { ListCustomersDto } from "./dto/list-customers.dto";
import { CustomersService } from "./customers.service";

@Controller("customers")
@UseGuards(ApiKeyGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}
  @Post()
  @RequireScopes("customers:write")
  create(@Req() request: MerchantRequest, @Body() dto: CreateCustomerDto) {
    return this.customers.create(request.merchantId, dto);
  }
  @Get()
  @RequireScopes("customers:read")
  list(@Req() request: MerchantRequest, @Query() query: ListCustomersDto) {
    return this.customers.list(request.merchantId, query);
  }
  @Get(":id")
  @RequireScopes("customers:read")
  get(@Req() request: MerchantRequest, @Param("id") id: string) {
    return this.customers.get(request.merchantId, id);
  }
}
