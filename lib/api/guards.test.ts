import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "./errors";
import { assertSameOrigin } from "./guards";

const APP_ORIGIN = "https://carhaus.example.com";
const originalEnv: Record<string, string | undefined> = {};
const ENV_KEYS = [
  "APP_ORIGIN",
  "DATABASE_URL",
  "JWT_SECRET",
  "QUOTE_SECRET",
  "GOOGLE_MAPS_API_KEY",
] as const;

function buildRequest(origin: string | null): NextRequest {
  const headers = new Headers();
  if (origin !== null) {
    headers.set("origin", origin);
  }
  return new NextRequest(`${APP_ORIGIN}/api/trips`, { method: "POST", headers });
}

describe("assertSameOrigin", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
    }
    process.env.APP_ORIGIN = APP_ORIGIN;
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/carhaus";
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.QUOTE_SECRET = "b".repeat(32);
    process.env.GOOGLE_MAPS_API_KEY = "test-google-maps-api-key";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

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

  it("does not throw when the Origin header matches APP_ORIGIN exactly", () => {
    const req = buildRequest(APP_ORIGIN);
    expect(() => assertSameOrigin(req)).not.toThrow();
  });
});
