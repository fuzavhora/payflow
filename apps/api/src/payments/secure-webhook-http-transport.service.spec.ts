import { SecureWebhookHttpTransport } from "./secure-webhook-http-transport.service";

describe("SecureWebhookHttpTransport address policy", () => {
  const transport = new SecureWebhookHttpTransport();
  const isPublic = (transport as any).isPublicAddress.bind(transport) as (address: string, family: number) => boolean;

  it("allows globally routable IPv4 and IPv6 addresses", () => {
    expect(isPublic("1.1.1.1", 4)).toBe(true);
    expect(isPublic("2606:4700:4700::1111", 6)).toBe(true);
  });

  it("rejects private, loopback, link-local, documentation and reserved IPv4", () => {
    for (const address of ["10.0.0.1", "172.16.0.1", "192.168.1.1", "127.0.0.1", "169.254.1.1", "192.0.2.1", "198.18.0.1", "224.0.0.1", "240.0.0.1"]) {
      expect(isPublic(address, 4)).toBe(false);
    }
  });

  it("rejects non-global and special-purpose IPv6", () => {
    for (const address of ["::1", "::", "fc00::1", "fe80::1", "ff02::1", "2001:db8::1", "::ffff:192.168.1.1"]) {
      expect(isPublic(address, 6)).toBe(false);
    }
  });

  it("rejects address-family mismatches", () => {
    expect(isPublic("1.1.1.1", 6)).toBe(false);
    expect(isPublic("2606:4700::1", 4)).toBe(false);
  });
});
