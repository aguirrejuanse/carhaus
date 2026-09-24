import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const originalEnv: Record<string, string | undefined> = {};
const ENV_KEYS = [
  "APP_ORIGIN",
  "DATABASE_URL",
  "JWT_SECRET",
  "QUOTE_SECRET",
  "GOOGLE_MAPS_API_KEY",
] as const;
const originalFetch = global.fetch;

function buildRequest(query = "", fetchSite = "same-origin"): NextRequest {
  return new NextRequest(
    `https://carhaus.example.com/api/places/autocomplete${query}`,
    { headers: { "sec-fetch-site": fetchSite } },
  );
}

describe("GET /api/places/autocomplete", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
    process.env.APP_ORIGIN = "https://carhaus.example.com";
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/carhaus";
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.QUOTE_SECRET = "b".repeat(32);
    process.env.GOOGLE_MAPS_API_KEY = "test-google-maps-api-key";
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it("proxies suggestions with Argentina restriction and Mendoza bias", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          suggestions: [
            {
              placePrediction: {
                placeId: "ChIJ123",
                text: { text: "9 de Julio 1276, Guaymallén, Mendoza" },
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const res = await GET(buildRequest("?q=9%20de%20julio%201276"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      data: [
        { placeId: "ChIJ123", text: "9 de Julio 1276, Guaymallén, Mendoza" },
      ],
    });

    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://places.googleapis.com/v1/places:autocomplete");
    expect(
      (init.headers as Record<string, string>)["X-Goog-Api-Key"],
    ).toBe("test-google-maps-api-key");
    const sentBody = JSON.parse(String(init.body)) as {
      includedRegionCodes: string[];
      locationBias: unknown;
    };
    expect(sentBody.includedRegionCodes).toEqual(["ar"]);
    expect(sentBody.locationBias).toBeDefined();
  });

  it("returns 403 for cross-site requests without calling Google", async () => {
    const res = await GET(buildRequest("?q=guaymallen", "cross-site"));
    expect(res.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns an empty list for too-short queries without calling Google", async () => {
    const res = await GET(buildRequest("?q=ab"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: [] });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("maps provider failures to 502", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response("denied", { status: 403 }));

    const res = await GET(buildRequest("?q=guaymallen"));
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({
      error: expect.objectContaining({
        code: "places_provider_unavailable",
      }),
    });
  });
});
