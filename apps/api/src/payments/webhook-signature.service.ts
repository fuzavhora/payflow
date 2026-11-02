import { Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";

@Injectable()
export class WebhookSignatureService {
  sign(rawBody: Buffer, secret: string, timestampSeconds = Math.floor(Date.now() / 1000)): string {
    if (!Number.isSafeInteger(timestampSeconds) || timestampSeconds <= 0) throw new RangeError("Timestamp must be a positive integer.");
    const digest = createHmac("sha256", secret).update(String(timestampSeconds)).update(".").update(rawBody).digest("hex");
    return `t=${timestampSeconds},v1=${digest}`;
  }

  verify(rawBody: Buffer, secret: string, signatureHeader: string, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300): boolean {
    if (!Number.isSafeInteger(nowSeconds) || !Number.isSafeInteger(toleranceSeconds) || toleranceSeconds < 0) return false;
    const match = /^t=(\d+),v1=([a-f0-9]{64})$/.exec(signatureHeader);
    if (!match) return false;
    const timestamp = Number(match[1]);
    if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;
    const expected = Buffer.from(this.sign(rawBody, secret, timestamp).split("v1=")[1], "hex");
    const supplied = Buffer.from(match[2], "hex");
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  }
}
