import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { signAdminSession } from "@/lib/auth";
import { jsonSuccess } from "./errors";
import { mutationRoute } from "./route";

const APP_ORIGIN = "https://carhaus.example.com";
const originalEnv: Record<string, string | undefined> = {};
const ENV_KEYS = [
  "APP_ORIGIN",
  "DATABASE_URL",
  "JWT_SECRET",
  "QUOTE_SECRET",
  "GOOGLE_MAPS_API_KEY",
] as const;

const bodySchema = z.object({ name: z.string().min(1) });

function buildRequest(opts: {
  origin?: string | null;
  body?: unknown;
  adminCookie?: string;
}): NextRequest {
  const headers = new Headers();
  if (opts.origin !== null) {
    headers.set("origin", opts.origin ?? APP_ORIGIN);
  }
  headers.set("content-type", "application/json");

  const req = new NextRequest(`${APP_ORIGIN}/api/example`, {
    method: "POST",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  if (opts.adminCookie) {
    req.cookies.set("carhaus_admin", opts.adminCookie);
  }

  return req;
}

describe("mutationRoute", () => {
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

  it("returns 403 when the origin check fails, before validating the body", async () => {
    const handler = mutationRoute({
      schema: bodySchema,
      handler: async (input) => jsonSuccess(input),
    });

    const res = await handler(
      buildRequest({ origin: "https://evil.example.com", body: { name: "ok" } }),
      undefined,
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "csrf_origin_mismatch" },
    });
  });

  it("returns 401 when admin is required and no session cookie is present", async () => {
    const handler = mutationRoute({
      schema: bodySchema,
      admin: true,
      handler: async (input) => jsonSuccess(input),
    });

    const res = await handler(buildRequest({ body: { name: "ok" } }), undefined);

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "unauthorized" },
    });
  });

  it("returns 422 with field errors when the body fails schema validation", async () => {
    const handler = mutationRoute({
      schema: bodySchema,
      handler: async (input) => jsonSuccess(input),
    });

    const res = await handler(buildRequest({ body: { name: "" } }), undefined);

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe("validation_failed");
    expect(json.error.fields.name).toBeDefined();
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const headers = new Headers({
      origin: APP_ORIGIN,
      "content-type": "application/json",
    });
    const req = new NextRequest(`${APP_ORIGIN}/api/example`, {
      method: "POST",
      headers,
      body: "{not json",
    });
    const handler = mutationRoute({
      schema: bodySchema,
      handler: async (input) => jsonSuccess(input),
    });

    const res = await handler(req, undefined);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "invalid_json" },
    });
  });

  it("calls the handler with the parsed body when origin/admin/schema all pass", async () => {
    const token = await signAdminSession({
      adminId: "admin-1",
      email: "admin@carhaus.example.com",
    });
    const handler = mutationRoute({
      schema: bodySchema,
      admin: true,
      handler: async (input) => jsonSuccess({ received: input.name }),
    });

    const res = await handler(
      buildRequest({ body: { name: "ok" }, adminCookie: token }),
      undefined,
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { received: "ok" } });
  });
});
