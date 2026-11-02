import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, IsUrl, Matches, MaxLength } from "class-validator";

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
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(/^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$/, { each: true })
  @MaxLength(100, { each: true })
  events?: string[];
}
