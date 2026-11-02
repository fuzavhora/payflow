import { Injectable } from "@nestjs/common";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import { URL } from "node:url";

export interface WebhookHttpResult { statusCode: number; durationMs: number; }

const DNS_RESOLUTION_TIMEOUT_MS = 3000;

/**
 * HTTPS-only transport with DNS resolution, address screening and pinned lookup.
 * Redirects are never followed. Every resolved address must be globally routable.
 */
@Injectable()
export class SecureWebhookHttpTransport {
  private readonly blockedIpv4 = new BlockList();
  private readonly blockedIpv6 = new BlockList();
  private readonly globalIpv6 = new BlockList();

  constructor() {
    // Keep address-family policies separate: Node's BlockList can treat IPv4-mapped
    // IPv6 ranges as overlapping IPv4 when both families share one instance.
    for (const [range, prefix] of [
      ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
      ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
      ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
      ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
    ] as const) this.blockedIpv4.addSubnet(range, prefix, "ipv4");

    for (const [range, prefix] of [
      ["::", 128], ["::1", 128], ["::ffff:0:0", 96], ["64:ff9b::", 96],
      ["100::", 64], ["2001::", 23], ["2001:db8::", 32], ["2002::", 16],
      ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
    ] as const) this.blockedIpv6.addSubnet(range, prefix, "ipv6");
    this.globalIpv6.addSubnet("2000::", 3, "ipv6");
  }

  async post(urlValue: string, body: Buffer, headers: Record<string, string>, timeoutMs = 8000): Promise<WebhookHttpResult> {
    const url = new URL(urlValue);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("Webhook destination must be a clean HTTPS URL.");
    if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 30000) throw new RangeError("Webhook timeout must be between 500 and 30000 milliseconds.");

    const resolved = await this.resolveWithTimeout(url.hostname);
    if (resolved.length === 0) throw new Error("Webhook hostname did not resolve.");
    for (const entry of resolved) {
      if (!this.isPublicAddress(entry.address, entry.family)) throw new Error("Webhook hostname resolves to a non-public IP address.");
    }
    const pinned = resolved[0];
    if (!pinned) throw new Error("Webhook hostname did not resolve to a usable address.");

    const started = Date.now();
    return new Promise((resolve, reject) => {
      const req = httpsRequest(url, {
        method: "POST",
        headers: { ...headers, "content-length": String(body.length) },
        timeout: timeoutMs,
        servername: url.hostname,
        rejectUnauthorized: true,
        lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
      }, (response) => {
        let received = 0;
        response.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (received > 16 * 1024) req.destroy(new Error("Webhook response exceeded 16 KiB."));
        });
        response.on("end", () => resolve({
          statusCode: response.statusCode ?? 0,
          durationMs: Date.now() - started,
        }));
      });
      req.on("timeout", () => req.destroy(new Error("Webhook request timed out.")));
      req.on("error", reject);
      req.end(body);
    });
  }

  private async resolveWithTimeout(hostname: string) {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error("Webhook hostname DNS resolution timed out.")), DNS_RESOLUTION_TIMEOUT_MS);
      timer.unref?.();
    });
    try {
      return await Promise.race([lookup(hostname, { all: true, verbatim: true }), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private isPublicAddress(address: string, family: number): boolean {
    const actualFamily = isIP(address);
    if (actualFamily !== family) return false;
    if (family === 4) return !this.blockedIpv4.check(address, "ipv4");
    if (family === 6) {
      // Only global-unicast 2000::/3 is accepted, excluding special-purpose ranges.
      return this.globalIpv6.check(address, "ipv6") && !this.blockedIpv6.check(address, "ipv6");
    }
    return false;
  }
}
