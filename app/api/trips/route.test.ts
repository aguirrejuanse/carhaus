import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signQuote, type QuotePayload } from "@/lib/quote";
import { verifyRiderSession } from "@/lib/rider";
import { createTripBooking } from "@/db/queries";
import { POST } from "./route";

const USER_ID = "user-111";
const PUBLIC_TOKEN = "pub-token-abc";

vi.mock("@/db/queries", () => ({
  upsertUserByEmail: vi.fn(async (email: string) => ({
    id: USER_ID,
    email,
  })),
  createTripBooking: vi.fn(async () => ({ id: "trip-1", publicToken: PUBLIC_TOKEN })),
}));

const APP_ORIGIN = "https://carhaus.example.com";
const QUOTE_SECRET = "b".repeat(32);
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
  return new NextRequest(`${APP_ORIGIN}/api/trips`, {
    method: "POST",
    headers: new Headers({
      origin: APP_ORIGIN,
      "content-type": "application/json",
    }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const quotePayload: QuotePayload = {
  legs: [
    {
      sequence: 1,
      origin: "Guaymallén, Mendoza",
      destination: "Plaza Shopping, Mendoza",
      scheduledAt: "2026-10-01T15:00:00.000Z",
      distanceMeters: 10000,
      durationSeconds: 1200,
      priceCents: 940000,
    },
  ],
  totalPriceCents: 940000,
  exp: Date.now() + 15 * 60 * 1000,
};

const validBody = {
  email: "rider@example.com",
  legs: [
    {
      origin: "Guaymallén, Mendoza",
      destination: "Plaza Shopping, Mendoza",
      scheduledAt: "2026-10-01T15:00:00.000Z",
    },
  ],
  extras: { snackChoice: "sweet", spotifyPlaylistUrl: "https://open.spotify.com/playlist/x" },
};

describe("POST /api/trips", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
    }
    process.env.APP_ORIGIN = APP_ORIGIN;
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/carhaus";
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.QUOTE_SECRET = QUOTE_SECRET;
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

  it("returns 201 with publicToken, persists the quoted legs, and sets the rider cookie", async () => {
    const quoteToken = signQuote(quotePayload, QUOTE_SECRET);

    const res = await POST(buildRequest({ ...validBody, quoteToken }));

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({
      data: { publicToken: PUBLIC_TOKEN },
    });

    // Persists the signed quote's legs/pricing, not whatever the client sent.
    expect(createTripBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        tripType: "one_way",
        totalPriceCents: 940000,
        legs: [
          expect.objectContaining({
            sequence: 1,
            priceCents: 940000,
            distanceMeters: 10000,
          }),
        ],
        extras: expect.objectContaining({ snackChoice: "sweet" }),
      }),
    );

    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain("carhaus_rider=");
    expect(cookie).toContain("HttpOnly");
    const token = cookie!.match(/carhaus_rider=([^;]+)/)![1];
    await expect(verifyRiderSession(token)).resolves.toBe(USER_ID);
  });

  it("returns 409 for a tampered quote token", async () => {
    const res = await POST(
      buildRequest({ ...validBody, quoteToken: "aaaa.invalidsig" }),
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "quote_invalid" },
    });
    expect(createTripBooking).not.toHaveBeenCalled();
  });

  it("returns 409 for an expired quote token", async () => {
    const expired = signQuote(
      { ...quotePayload, exp: Date.now() - 1000 },
      QUOTE_SECRET,
    );

    const res = await POST(buildRequest({ ...validBody, quoteToken: expired }));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "quote_invalid" },
    });
  });

  it("returns 201 unpriced when no quoteToken (provider failure path)", async () => {
    const res = await POST(buildRequest(validBody));

    expect(res.status).toBe(201);
    expect(createTripBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        totalPriceCents: 0,
        legs: [expect.objectContaining({ priceCents: 0, distanceMeters: 0 })],
      }),
    );
  });

  it("returns 422 for an invalid email", async () => {
    const res = await POST(buildRequest({ ...validBody, email: "nope" }));

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "validation_failed" },
    });
  });
});
