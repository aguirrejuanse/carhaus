import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTemplate, listTemplatesByRiderEmail } from "@/db/queries";
import { signRiderSession } from "@/lib/rider";
import { GET, POST } from "./route";

const USER_ID = "user-111";
const RIDER_EMAIL = "rider@example.com";

vi.mock("@/db/queries", () => ({
  getUserById: vi.fn(async (id: string) =>
    id === USER_ID ? { id: USER_ID, email: RIDER_EMAIL } : null,
  ),
  listTemplatesByRiderEmail: vi.fn(async (email: string) => [
    { id: "tpl-1", riderEmail: email, name: "Casa → Trabajo" },
  ]),
  createTemplate: vi.fn(async (input: { name: string }) => ({
    id: "tpl-new",
    ...input,
  })),
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

async function buildPostRequest(opts: {
  body?: unknown;
  rider?: boolean;
}): Promise<NextRequest> {
  const req = new NextRequest(`${APP_ORIGIN}/api/templates`, {
    method: "POST",
    headers: new Headers({
      origin: APP_ORIGIN,
      "content-type": "application/json",
    }),
    body: JSON.stringify(opts.body ?? {}),
  });
  if (opts.rider) {
    req.cookies.set("carhaus_rider", await signRiderSession(USER_ID));
  }
  return req;
}

async function buildGetRequest(rider: boolean): Promise<NextRequest> {
  const req = new NextRequest(`${APP_ORIGIN}/api/templates`, {
    method: "GET",
  });
  if (rider) {
    req.cookies.set("carhaus_rider", await signRiderSession(USER_ID));
  }
  return req;
}

const validBody = {
  name: "Casa → Trabajo",
  legs: [{ origin: "Casa", destination: "Trabajo" }],
  extras: { snackChoice: "salty" },
};

describe("POST /api/templates", () => {
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
    vi.clearAllMocks();
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  it("returns 201 and saves the template under the rider's email", async () => {
    const res = await POST(await buildPostRequest({ body: validBody, rider: true }));

    expect(res.status).toBe(201);
    expect(createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        riderEmail: RIDER_EMAIL,
        name: "Casa → Trabajo",
        tripType: "one_way",
        legs: [{ sequence: 1, origin: "Casa", destination: "Trabajo" }],
      }),
    );
  });

  it("returns 401 without a rider session", async () => {
    const res = await POST(await buildPostRequest({ body: validBody }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "unauthorized" },
    });
    expect(createTemplate).not.toHaveBeenCalled();
  });

  it("returns 422 for a body without legs", async () => {
    const res = await POST(
      await buildPostRequest({ body: { name: "x", legs: [] }, rider: true }),
    );

    expect(res.status).toBe(422);
  });
});

describe("GET /api/templates", () => {
  beforeEach(() => {
    process.env.APP_ORIGIN = APP_ORIGIN;
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/carhaus";
    process.env.JWT_SECRET = JWT_SECRET;
  });

  it("lists templates scoped to the rider's email", async () => {
    const res = await GET(await buildGetRequest(true));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.templates).toHaveLength(1);
    expect(listTemplatesByRiderEmail).toHaveBeenCalledWith(RIDER_EMAIL);
  });

  it("returns an empty list without a rider session", async () => {
    const res = await GET(await buildGetRequest(false));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { templates: [] } });
    expect(listTemplatesByRiderEmail).not.toHaveBeenCalled();
  });
});
