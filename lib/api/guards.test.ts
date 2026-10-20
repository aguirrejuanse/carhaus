import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { ApiError } from "./errors";
import { assertSameOrigin, clientIp } from "./guards";

const APP_ORIGIN = "https://carhaus.example.com";

function buildRequest(origin: string | null, url = APP_ORIGIN): NextRequest {
  const headers = new Headers();
  if (origin !== null) {
    headers.set("origin", origin);
  }
  return new NextRequest(`${url}/api/trips`, { method: "POST", headers });
}

describe("assertSameOrigin", () => {
  it("throws csrf_origin_mismatch when the Origin header is missing", () => {
    const req = buildRequest(null);
    expect(() => assertSameOrigin(req)).toThrow(ApiError);
    try {
      assertSameOrigin(req);
      expect.fail("expected assertSameOrigin to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(403);
      expect((error as ApiError).code).toBe("csrf_origin_mismatch");
    }
  });

  it("throws csrf_origin_mismatch when the Origin header is foreign", () => {
    const req = buildRequest("https://evil.example.com");
    expect(() => assertSameOrigin(req)).toThrow(ApiError);
    try {
      assertSameOrigin(req);
      expect.fail("expected assertSameOrigin to throw");
    } catch (error) {
      expect((error as ApiError).code).toBe("csrf_origin_mismatch");
    }
  });

  it("does not throw when the Origin header matches the request host", () => {
    const req = buildRequest(APP_ORIGIN);
    expect(() => assertSameOrigin(req)).not.toThrow();
  });

  it("accepts any same-host origin — Vercel branch aliases differ from VERCEL_URL", () => {
    const alias = "https://carhaus-git-carhaus-pr6-login-x.vercel.app";
    const req = buildRequest(alias, alias);
    expect(() => assertSameOrigin(req)).not.toThrow();
  });

  it("rejects an Origin that matches APP_ORIGIN but hits a different host", () => {
    const req = buildRequest(APP_ORIGIN, "https://unexpected.vercel.app");
    expect(() => assertSameOrigin(req)).toThrow(ApiError);
  });
});

describe("clientIp", () => {
  function reqWithForwardedFor(value?: string): NextRequest {
    const headers = new Headers();
    if (value !== undefined) headers.set("x-forwarded-for", value);
    return new NextRequest(`${APP_ORIGIN}/api/x`, {
      method: "POST",
      headers,
    });
  }

  it("returns the first entry of a proxy chain", () => {
    expect(clientIp(reqWithForwardedFor("203.0.113.7, 10.0.0.1, 10.0.0.2"))).toBe(
      "203.0.113.7",
    );
  });

  it("trims whitespace around a single value", () => {
    expect(clientIp(reqWithForwardedFor(" 203.0.113.7 "))).toBe("203.0.113.7");
  });

  it("returns undefined when the header is absent (local dev)", () => {
    expect(clientIp(reqWithForwardedFor())).toBeUndefined();
  });
});
