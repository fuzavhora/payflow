import { IsArray, IsBoolean, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class UpdateWebhookEndpointDto {
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ["https"] })
  @MaxLength(2048)
  url?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  events?: string[];
}
