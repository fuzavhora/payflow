import { IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, Matches } from "class-validator";
export class CreatePaymentIntentDto {
  @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER)
  amount!: number;
  @IsString() @Matches(/^[A-Z]{3}$/)
  currency!: string;
  @IsOptional() @IsString() @MaxLength(100)
  customerId?: string;
  @IsOptional() @IsString() @MaxLength(500)
  description?: string;
  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}
