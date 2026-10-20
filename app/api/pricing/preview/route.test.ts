import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DistanceProviderError, GoogleDistanceProvider } from "@/lib/distance";
import { verifyQuote } from "@/lib/quote";
import { POST } from "./route";

vi.mock("@/db/queries", () => ({
  getActivePricingRules: vi.fn(async () => ({
    baseFareCents: 150000,
    perKmCents: 55000,
    perMinuteCents: 12000,
    minimumFareCents: 250000,
    nightMultiplierBasisPoints: 15000,
    nightStartHour: 22,
    nightEndHour: 6,
  })),
  countRecentPricingPreviewRequests: vi.fn(async () => 0),
  recordPricingPreviewRequest: vi.fn(async () => {}),
}));

const APP_ORIGIN = "https://carhaus.example.com";
const QUOTE_SECRET = "b".repeat(32);
const originalEnv: Record<string, string | undefined> = {};
const ENV_KEYS = [
  "APP_ORIGIN",
  "DATABASE_URL",
  "JWT_SECRET",
  "QUOTE_SECRET",
  "GOOGLE_MAPS_API_KEY",
] as const;

function buildRequest(body?: unknown, ip?: string): NextRequest {
  const headers = new Headers({
    origin: APP_ORIGIN,
    "content-type": "application/json",
  });
  if (ip) headers.set("x-forwarded-for", ip);
  return new NextRequest(`${APP_ORIGIN}/api/pricing/preview`, {
    method: "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Future timestamps relative to now — hardcoded ISO dates go stale and
 *  start failing the past-booking refinement. UTC hours are picked so the
 *  ART (UTC-3) local hour lands outside/inside the 22→6 night window. */
function futureIso(daysAhead: number, utcHour: number): string {
  const date = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  date.setUTCHours(utcHour, 0, 0, 0);
  return date.toISOString();
}

const validBody = {
  legs: [
    {
      origin: "Guaymallén, Mendoza",
      destination: "Plaza Shopping, Mendoza",
      // 15:00 UTC = 12:00 ART — midday, outside the 22→6 night window.
      scheduledAt: futureIso(7, 15),
    },
  ],
};

describe("POST /api/pricing/preview", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
    }
    process.env.APP_ORIGIN = APP_ORIGIN;
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/carhaus";
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.QUOTE_SECRET = QUOTE_SECRET;
    process.env.GOOGLE_MAPS_API_KEY = "test-google-maps-api-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  it("returns 200 with a priced quote and a verifiable signed token", async () => {
    vi.spyOn(GoogleDistanceProvider.prototype, "getDistance").mockResolvedValue({
      distanceMeters: 10000,
      durationSeconds: 1200,
      resolvedOrigin: "Guaymallén, Mendoza, Argentina",
      resolvedDestination: "Plaza Shopping, Mendoza, Argentina",
    });

    const res = await POST(buildRequest(validBody));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.token).toEqual(expect.any(String));
    // 150000 + 10km*55000 + 20min*12000 = 940000, no night multiplier.
    expect(json.data.quote.totalPriceCents).toBe(940000);
    expect(json.data.quote.legs).toHaveLength(1);
    expect(json.data.resolved[0]).toEqual({
      origin: "Guaymallén, Mendoza, Argentina",
      destination: "Plaza Shopping, Mendoza, Argentina",
    });
    expect(json.data.mapUrl).toContain("/api/map/static?");
    expect(json.data.mapUrl).toContain("sig=");

    const payload = verifyQuote(json.data.token, QUOTE_SECRET);
    expect(payload.totalPriceCents).toBe(json.data.quote.totalPriceCents);
    expect(payload.legs[0].origin).toBe(validBody.legs[0].origin);
  });

  it("prices each leg independently for a 2-leg round trip", async () => {
    const getDistance = vi
      .spyOn(GoogleDistanceProvider.prototype, "getDistance")
      .mockResolvedValue({
        distanceMeters: 10000,
        durationSeconds: 1200,
        resolvedOrigin: "A",
        resolvedDestination: "B",
      });

    const res = await POST(
      buildRequest({
        legs: [
          validBody.legs[0],
          {
            origin: "Plaza Shopping, Mendoza",
            destination: "Guaymallén, Mendoza",
            // 02:00 UTC = 23:00 ART — inside the 22→6 night window (1.5x).
            scheduledAt: futureIso(8, 2),
          },
        ],
      }),
    );

    expect(res.status).toBe(200);
    expect(getDistance).toHaveBeenCalledTimes(2);
    const json = await res.json();
    const [leg1, leg2] = json.data.quote.legs;
    expect(leg1.priceCents).toBe(940000);
    expect(leg2.priceCents).toBe(1410000); // 940000 * 1.5
    expect(json.data.quote.totalPriceCents).toBe(2350000);
  });

  it("returns 502 when the distance provider fails", async () => {
    vi.spyOn(GoogleDistanceProvider.prototype, "getDistance").mockRejectedValue(
      new DistanceProviderError("provider timed out"),
    );

    const res = await POST(buildRequest(validBody));

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "distance_provider_unavailable" },
    });
  });

  it("returns 422 for more than 2 legs", async () => {
    const res = await POST(
      buildRequest({ legs: [validBody.legs[0], validBody.legs[0], validBody.legs[0]] }),
    );

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "validation_failed" },
    });
  });

  it("returns 429 past the per-IP cap without calling the provider", async () => {
    const { countRecentPricingPreviewRequests } = await import("@/db/queries");
    vi.mocked(countRecentPricingPreviewRequests).mockResolvedValueOnce(20);
    const getDistance = vi.spyOn(
      GoogleDistanceProvider.prototype,
      "getDistance",
    );

    const res = await POST(buildRequest(validBody, "203.0.113.7"));

    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "preview_rate_limited" },
    });
    expect(getDistance).not.toHaveBeenCalled();
  });

  it("returns 403 without a matching Origin header", async () => {
    const req = new NextRequest(`${APP_ORIGIN}/api/pricing/preview`, {
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      body: JSON.stringify(validBody),
    });

    const res = await POST(req);

    expect(res.status).toBe(403);
  });
});
