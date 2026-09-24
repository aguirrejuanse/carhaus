import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyAdminSession } from "@/lib/auth";
import { POST } from "./route";

const ADMIN_ID = "admin-1";
const ADMIN_EMAIL = "admin@carhaus.dev";
const passwordHash = bcrypt.hashSync("correct-password", 10);

vi.mock("@/db/queries", () => ({
  getAdminByEmail: vi.fn(async (email: string) =>
    email === ADMIN_EMAIL
      ? { id: ADMIN_ID, email: ADMIN_EMAIL, passwordHash }
      : null,
  ),
}));

const APP_ORIGIN = "https://carhaus.example.com";
const JWT_SECRET = "a".repeat(32);
const originalEnv: Record<string, string | undefined> = {};
const ENV_KEYS = [
  "APP_ORIGIN",
  "DATABASE_URL",
  "JWT_SECRET",
  "QUOTE_SECRET",
  "GOOGLE_MAPS_API_KEY",
] as const;

function buildRequest(body?: unknown): NextRequest {
  return new NextRequest(`${APP_ORIGIN}/api/admin/login`, {
    method: "POST",
    headers: new Headers({
      origin: APP_ORIGIN,
      "content-type": "application/json",
    }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("POST /api/admin/login", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
    }
    process.env.APP_ORIGIN = APP_ORIGIN;
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/carhaus";
    process.env.JWT_SECRET = JWT_SECRET;
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

  it("returns 200 and sets a verifiable admin session cookie", async () => {
    const res = await POST(
      buildRequest({ email: ADMIN_EMAIL, password: "correct-password" }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      data: { email: ADMIN_EMAIL },
    });

    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain("carhaus_admin=");
    expect(cookie).toContain("HttpOnly");
    const token = cookie!.match(/carhaus_admin=([^;]+)/)![1];
    await expect(verifyAdminSession(token)).resolves.toEqual({
      adminId: ADMIN_ID,
      email: ADMIN_EMAIL,
    });
  });

  it("returns 401 for a wrong password", async () => {
    const res = await POST(
      buildRequest({ email: ADMIN_EMAIL, password: "wrong" }),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "invalid_credentials" },
    });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("returns 401 for an unknown email (same code — no enumeration)", async () => {
    const res = await POST(
      buildRequest({ email: "nobody@example.com", password: "whatever" }),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "invalid_credentials" },
    });
  });

  it("returns 422 for a malformed body", async () => {
    const res = await POST(buildRequest({ email: "not-an-email" }));

    expect(res.status).toBe(422);
  });
});
