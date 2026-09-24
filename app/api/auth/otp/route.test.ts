import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requestEmailCode = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/otp", () => ({ requestEmailCode }));

import { ApiError } from "@/lib/api/errors";
import { POST } from "./route";

const APP_ORIGIN = "https://carhaus.example.com";
const originalEnv: Record<string, string | undefined> = {};
const ENV_KEYS = ["APP_ORIGIN", "DATABASE_URL", "JWT_SECRET"] as const;

function buildRequest(body?: unknown): NextRequest {
  return new NextRequest(`${APP_ORIGIN}/api/auth/otp`, {
    method: "POST",
    headers: new Headers({
      origin: APP_ORIGIN,
      "content-type": "application/json",
    }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("POST /api/auth/otp", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
    }
    process.env.APP_ORIGIN = APP_ORIGIN;
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/carhaus";
    process.env.JWT_SECRET = "a".repeat(32);
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

  it("issues a code for a valid email", async () => {
    const res = await POST(buildRequest({ email: "rider@example.com" }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { sent: true } });
    expect(requestEmailCode).toHaveBeenCalledWith("rider@example.com");
  });

  it("returns 422 for an invalid email", async () => {
    const res = await POST(buildRequest({ email: "nope" }));

    expect(res.status).toBe(422);
    expect(requestEmailCode).not.toHaveBeenCalled();
  });

  it("surfaces the cooldown as 429", async () => {
    requestEmailCode.mockRejectedValueOnce(
      new ApiError(429, "otp_cooldown", "wait"),
    );

    const res = await POST(buildRequest({ email: "rider@example.com" }));

    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "otp_cooldown" },
    });
  });
});
