import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DistanceProviderError, GoogleDistanceProvider } from "./distance";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { "content-type": "application/json" },
  });
}

describe("GoogleDistanceProvider", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns distance/duration on a successful lookup", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse({
        status: "OK",
        rows: [
          {
            elements: [
              {
                status: "OK",
                distance: { value: 12500 },
                duration: { value: 900 },
              },
            ],
          },
        ],
      }),
    );

    const provider = new GoogleDistanceProvider("test-key");
    const result = await provider.getDistance("Origin St 1", "Destination Ave 2");

    expect(result).toEqual({ distanceMeters: 12500, durationSeconds: 900 });
  });

  it("passes origin/destination/key as query params to the Distance Matrix endpoint", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse({
        status: "OK",
        rows: [
          {
            elements: [
              { status: "OK", distance: { value: 1 }, duration: { value: 1 } },
            ],
          },
        ],
      }),
    );

    const provider = new GoogleDistanceProvider("test-key");
    await provider.getDistance("A", "B");

    const calledUrl = vi.mocked(global.fetch).mock.calls[0][0] as URL;
    expect(calledUrl.toString()).toContain(
      "https://maps.googleapis.com/maps/api/distancematrix/json",
    );
    expect(calledUrl.searchParams.get("origins")).toBe("A");
    expect(calledUrl.searchParams.get("destinations")).toBe("B");
    expect(calledUrl.searchParams.get("key")).toBe("test-key");
  });

  it("throws DistanceProviderError when the request times out", async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(
      new DOMException("The operation was aborted", "TimeoutError"),
    );

    const provider = new GoogleDistanceProvider("test-key");

    await expect(provider.getDistance("A", "B")).rejects.toThrow(
      DistanceProviderError,
    );
  });

  it("throws DistanceProviderError when the HTTP response is not ok", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse({}, { status: 500 }),
    );

    const provider = new GoogleDistanceProvider("test-key");

    await expect(provider.getDistance("A", "B")).rejects.toThrow(
      DistanceProviderError,
    );
  });

  it("throws DistanceProviderError when the provider status is not OK", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse({ status: "REQUEST_DENIED" }),
    );

    const provider = new GoogleDistanceProvider("test-key");

    await expect(provider.getDistance("A", "B")).rejects.toThrow(
      DistanceProviderError,
    );
  });

  it("throws DistanceProviderError when no route is found for the element", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse({
        status: "OK",
        rows: [{ elements: [{ status: "NOT_FOUND" }] }],
      }),
    );

    const provider = new GoogleDistanceProvider("test-key");

    await expect(provider.getDistance("A", "B")).rejects.toThrow(
      DistanceProviderError,
    );
  });
});
