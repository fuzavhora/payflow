import { Request } from "express";
export interface MerchantRequest extends Request {
  merchantId: string;
  apiKeyId: string;
  apiKeyScopes: string[];
}
