import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString, IsUrl, Matches, MaxLength } from "class-validator";

export class CreateWebhookEndpointDto {
  @IsUrl({ require_protocol: true, protocols: ["https"] })
  @MaxLength(2048)
  url!: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ArrayNotEmpty()
  @IsString({ each: true })
  @Matches(/^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$/, { each: true })
  @MaxLength(100, { each: true })
  events!: string[];
}
