import { EventEmitter } from "node:events";
import * as dnsPromises from "node:dns/promises";
import * as https from "node:https";
import { SecureWebhookHttpTransport } from "./secure-webhook-http-transport.service";

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));
jest.mock("node:https", () => ({ request: jest.fn() }));

describe("SecureWebhookHttpTransport", () => {
  const transport = new SecureWebhookHttpTransport();
  const isPublic = (transport as any).isPublicAddress.bind(transport) as (address: string, family: number) => boolean;
  const lookupMock = dnsPromises.lookup as jest.Mock;
  const requestMock = https.request as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it("pins the HTTPS request to a screened address and keeps TLS verification enabled", async () => {
    lookupMock.mockResolvedValue([
      { address: "1.1.1.1", family: 4 },
      { address: "2606:4700:4700::1111", family: 6 },
    ]);
    requestMock.mockImplementation((_url, options, callback) => {
      const req = new EventEmitter() as EventEmitter & { end: jest.Mock; destroy: jest.Mock };
      req.end = jest.fn(() => {
        const response = new EventEmitter() as EventEmitter & { statusCode: number };
        response.statusCode = 204;
        callback(response);
        response.emit("end");
      });
      req.destroy = jest.fn((error?: Error) => { if (error) req.emit("error", error); });
      return req;
    });

    const result = await transport.post(
      "https://hooks.example.com/events",
      Buffer.from('{"id":"evt_1"}'),
      { "content-type": "application/json" },
    );
    const options = requestMock.mock.calls[0][1];
    expect(result.statusCode).toBe(204);
    expect(options.rejectUnauthorized).toBe(true);
    expect(options.servername).toBe("hooks.example.com");
    expect(options.lookup).toBeInstanceOf(Function);
    expect(lookupMock).toHaveBeenCalledWith("hooks.example.com", { all: true, verbatim: true });

    const lookupResult = await new Promise((resolve, reject) => {
      options.lookup("hooks.example.com", {}, (error: Error | null, address: string, family: number) => {
        if (error) reject(error);
        else resolve({ address, family });
      });
    });
    expect(lookupResult).toEqual({ address: "1.1.1.1", family: 4 });
  });

  it("rejects a mixed public/private DNS answer set before opening a socket", async () => {
    lookupMock.mockResolvedValue([
      { address: "1.1.1.1", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    await expect(transport.post(
      "https://hooks.example.com/events", Buffer.from("{}"), {},
    )).rejects.toThrow("non-public IP");
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("does not follow HTTP redirects", async () => {
    lookupMock.mockResolvedValue([{ address: "1.1.1.1", family: 4 }]);
    requestMock.mockImplementation((_url, _options, callback) => {
      const req = new EventEmitter() as EventEmitter & { end: jest.Mock; destroy: jest.Mock };
      req.end = jest.fn(() => {
        const response = new EventEmitter() as EventEmitter & { statusCode: number };
        response.statusCode = 302;
        callback(response);
        response.emit("end");
      });
      req.destroy = jest.fn((error?: Error) => { if (error) req.emit("error", error); });
      return req;
    });
    const result = await transport.post("https://hooks.example.com/events", Buffer.from("{}"), {});
    expect(result.statusCode).toBe(302);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });
});
