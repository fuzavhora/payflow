import { WebhookSignatureService } from "./webhook-signature.service";

describe("WebhookSignatureService", () => {
  const service = new WebhookSignatureService();
  const secret = "whsec_test_secret";
  const body = Buffer.from(JSON.stringify({ id: "evt_123", type: "payment_intent.succeeded" }));

  it("signs raw payload bytes and verifies a valid timestamped signature", () => {
    const header = service.sign(body, secret, 1_800_000_000);
    expect(header).toMatch(/^t=1800000000,v1=[a-f0-9]{64}$/);
    expect(service.verify(body, secret, header, 1_800_000_010)).toBe(true);
  });

  it("rejects modified payloads and wrong secrets", () => {
    const header = service.sign(body, secret, 1_800_000_000);
    expect(service.verify(Buffer.from("tampered"), secret, header, 1_800_000_000)).toBe(false);
    expect(service.verify(body, "another-secret", header, 1_800_000_000)).toBe(false);
  });

  it("rejects stale timestamps and malformed headers", () => {
    const header = service.sign(body, secret, 1_800_000_000);
    expect(service.verify(body, secret, header, 1_800_000_400)).toBe(false);
    expect(service.verify(body, secret, "v1=not-a-signature", 1_800_000_000)).toBe(false);
  });
});
