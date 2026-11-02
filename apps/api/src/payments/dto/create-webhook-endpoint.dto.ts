import { ArrayNotEmpty, IsArray, IsString, IsUrl, MaxLength } from "class-validator";

export class CreateWebhookEndpointDto {
  @IsUrl({ require_protocol: true, protocols: ["https"] })
  @MaxLength(2048)
  url!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  events!: string[];
}
