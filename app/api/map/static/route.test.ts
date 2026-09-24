import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signMapParams } from "@/lib/quote";
import { GET } from "./route";

const QUOTE_SECRET = "b".repeat(32);
const originalEnv: Record<string, string | undefined> = {};
const ENV_KEYS = [
  "APP_ORIGIN",
  "DATABASE_URL",
  "JWT_SECRET",
  "QUOTE_SECRET",
  "GOOGLE_MAPS_API_KEY",
] as const;
const originalFetch = global.fetch;

function buildRequest(query = ""): NextRequest {
  return new NextRequest(`https://carhaus.example.com/api/map/static${query}`);
}

const validParams = () => {
  const o = "Guaymallén, Mendoza, Argentina";
  const d = "Aeropuerto El Plumerillo, Mendoza, Argentina";
  const sig = signMapParams(o, d, QUOTE_SECRET);
  return { o, d, sig };
};

describe("GET /api/map/static", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
    process.env.APP_ORIGIN = "https://carhaus.example.com";
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/carhaus";
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.QUOTE_SECRET = QUOTE_SECRET;
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

  it("proxies the static map for a valid signature", async () => {
    const { o, d, sig } = validParams();
    global.fetch = vi.fn().mockResolvedValue(
      new Response("PNG-BYTES", {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );

    const res = await GET(
      buildRequest(
        `?o=${encodeURIComponent(o)}&d=${encodeURIComponent(d)}&sig=${sig}`,
      ),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(await res.text()).toBe("PNG-BYTES");

    const calledUrl = vi.mocked(global.fetch).mock.calls[0][0] as URL;
    expect(calledUrl.hostname).toBe("maps.googleapis.com");
    expect(calledUrl.searchParams.get("key")).toBe("test-google-maps-api-key");
    expect(calledUrl.searchParams.getAll("markers")).toHaveLength(2);
  });

  it("returns 403 for a tampered signature", async () => {
    const { o, d } = validParams();
    const res = await GET(
      buildRequest(
        `?o=${encodeURIComponent(o)}&d=${encodeURIComponent(d)}&sig=deadbeef`,
      ),
    );
    expect(res.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns 400 when params are missing", async () => {
    const res = await GET(buildRequest("?o=only-origin"));
    expect(res.status).toBe(400);
  });
});
