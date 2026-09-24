import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const verifyEmailCode = vi.hoisted(() =>
  vi.fn(async (email: string) => ({ id: "user-1", email })),
);
vi.mock("@/lib/otp", () => ({ verifyEmailCode }));
// lib/rider.ts imports getUserById; stub the db layer (server-only).
vi.mock("@/db/queries", () => ({ getUserById: vi.fn() }));

import { ApiError } from "@/lib/api/errors";
import { verifyRiderSession } from "@/lib/rider";
import { POST } from "./route";

const APP_ORIGIN = "https://carhaus.example.com";
const originalEnv: Record<string, string | undefined> = {};
const ENV_KEYS = [
  "APP_ORIGIN",
  "DATABASE_URL",
  "JWT_SECRET",
  "QUOTE_SECRET",
  "GOOGLE_MAPS_API_KEY",
] as const;

function buildRequest(body?: unknown): NextRequest {
  return new NextRequest(`${APP_ORIGIN}/api/auth/verify`, {
    method: "POST",
    headers: new Headers({
      origin: APP_ORIGIN,
      "content-type": "application/json",
    }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("POST /api/auth/verify", () => {
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
    vi.clearAllMocks();
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  it("sets the rider session cookie on a valid code", async () => {
    const res = await POST(
      buildRequest({ email: "rider@example.com", code: "123456" }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      data: { email: "rider@example.com" },
    });
    expect(verifyEmailCode).toHaveBeenCalledWith(
      "rider@example.com",
      "123456",
    );

    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain("carhaus_rider=");
    expect(cookie).toContain("HttpOnly");
    const token = cookie!.match(/carhaus_rider=([^;]+)/)![1];
    await expect(verifyRiderSession(token)).resolves.toBe("user-1");
  });

  it("returns 401 for a wrong code", async () => {
    verifyEmailCode.mockRejectedValueOnce(
      new ApiError(401, "otp_invalid", "wrong"),
    );

    const res = await POST(
      buildRequest({ email: "rider@example.com", code: "000000" }),
    );

    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("returns 422 for a malformed code", async () => {
    const res = await POST(
      buildRequest({ email: "rider@example.com", code: "abc" }),
    );

    expect(res.status).toBe(422);
    expect(verifyEmailCode).not.toHaveBeenCalled();
  });
});
