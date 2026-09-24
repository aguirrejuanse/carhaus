import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ADMIN_COOKIE_NAME,
  AdminSessionError,
  requireAdmin,
  signAdminSession,
  verifyAdminSession,
} from "./auth";
import { ApiError } from "./api/errors";

const JWT_SECRET = "a".repeat(32);
const originalEnv: Record<string, string | undefined> = {};
const ENV_KEYS = [
  "APP_ORIGIN",
  "DATABASE_URL",
  "JWT_SECRET",
  "QUOTE_SECRET",
  "GOOGLE_MAPS_API_KEY",
] as const;

function buildRequestWithCookie(token: string | undefined): NextRequest {
  const req = new NextRequest("https://carhaus.example.com/api/admin/trips/1", {
    method: "PATCH",
  });
  if (token !== undefined) {
    req.cookies.set(ADMIN_COOKIE_NAME, token);
  }
  return req;
}

describe("admin session JWT", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
    }
    process.env.APP_ORIGIN = "https://carhaus.example.com";
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

  describe("signAdminSession / verifyAdminSession", () => {
    it("round-trips a signed session back to the original payload", async () => {
      const token = await signAdminSession({
        adminId: "admin-1",
        email: "admin@carhaus.example.com",
      });

      const payload = await verifyAdminSession(token);

      expect(payload).toEqual({
        adminId: "admin-1",
        email: "admin@carhaus.example.com",
      });
    });

    it("rejects an expired token", async () => {
      const secret = new TextEncoder().encode(JWT_SECRET);
      const expiredToken = await new SignJWT({
        adminId: "admin-1",
        email: "admin@carhaus.example.com",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
        .sign(secret);

      await expect(verifyAdminSession(expiredToken)).rejects.toThrow(
        AdminSessionError,
      );
    });

    it("rejects a tampered token", async () => {
      const token = await signAdminSession({
        adminId: "admin-1",
        email: "admin@carhaus.example.com",
      });
      const tampered = `${token.slice(0, -2)}xx`;

      await expect(verifyAdminSession(tampered)).rejects.toThrow(
        AdminSessionError,
      );
    });
  });

  describe("requireAdmin", () => {
    it("throws 401 ApiError when the cookie is absent", async () => {
      const req = buildRequestWithCookie(undefined);
      await expect(requireAdmin(req)).rejects.toMatchObject({
        status: 401,
        code: "unauthorized",
      });
      await expect(requireAdmin(req)).rejects.toBeInstanceOf(ApiError);
    });

    it("throws 401 ApiError when the cookie holds an expired token", async () => {
      const secret = new TextEncoder().encode(JWT_SECRET);
      const expiredToken = await new SignJWT({
        adminId: "admin-1",
        email: "admin@carhaus.example.com",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
        .sign(secret);
      const req = buildRequestWithCookie(expiredToken);

      await expect(requireAdmin(req)).rejects.toMatchObject({
        status: 401,
        code: "unauthorized",
      });
    });

    it("throws 401 ApiError when the cookie holds a tampered token", async () => {
      const token = await signAdminSession({
        adminId: "admin-1",
        email: "admin@carhaus.example.com",
      });
      const req = buildRequestWithCookie(`${token.slice(0, -2)}xx`);

      await expect(requireAdmin(req)).rejects.toMatchObject({
        status: 401,
        code: "unauthorized",
      });
    });

    it("resolves the admin payload for a valid token", async () => {
      const token = await signAdminSession({
        adminId: "admin-1",
        email: "admin@carhaus.example.com",
      });
      const req = buildRequestWithCookie(token);

      await expect(requireAdmin(req)).resolves.toEqual({
        adminId: "admin-1",
        email: "admin@carhaus.example.com",
      });
    });
  });
});
