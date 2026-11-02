import { Transform } from "class-transformer";
import { IsEmail, IsObject, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCustomerDto {
  @Transform(({ value }) => typeof value === "string" ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
