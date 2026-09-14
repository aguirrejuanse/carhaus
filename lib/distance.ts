/**
 * Distance lookup for fare pricing (design decision: `DistanceProvider`
 * interface + Google Distance Matrix implementation, `AbortSignal.timeout`
 * guards every request so a slow/hanging provider never blocks the booking
 * form — spec: "Distance Provider Failure Handling").
 *
 * Google's classic Distance Matrix API is legacy (Routes API
 * `computeRouteMatrix` is the successor) — this interface makes swapping
 * providers a one-file change.
 */

const DISTANCE_MATRIX_ENDPOINT =
  "https://maps.googleapis.com/maps/api/distancematrix/json";

const REQUEST_TIMEOUT_MS = 5000;

export interface DistanceResult {
  distanceMeters: number;
  durationSeconds: number;
}

export interface DistanceProvider {
  getDistance(origin: string, destination: string): Promise<DistanceResult>;
}

/**
 * Thrown for any failure to resolve a distance (network error, timeout,
 * non-OK provider status, or no route found). Callers (the pricing preview
 * route) catch this and map it to `502` per the HTTP contract, without
 * blocking the rider from submitting the trip for admin review.
 */
export class DistanceProviderError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "DistanceProviderError";
  }
}

interface GoogleDistanceMatrixElement {
  status: string;
  distance?: { value: number };
  duration?: { value: number };
}

interface GoogleDistanceMatrixResponse {
  status: string;
  rows?: Array<{ elements: GoogleDistanceMatrixElement[] }>;
}

export class GoogleDistanceProvider implements DistanceProvider {
  constructor(private readonly apiKey: string) {}

  async getDistance(
    origin: string,
    destination: string,
  ): Promise<DistanceResult> {
    const url = new URL(DISTANCE_MATRIX_ENDPOINT);
    url.searchParams.set("origins", origin);
    url.searchParams.set("destinations", destination);
    url.searchParams.set("key", this.apiKey);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new DistanceProviderError(
        "Distance provider request failed or timed out",
        error,
      );
    }

    if (!response.ok) {
      throw new DistanceProviderError(
        `Distance provider responded with HTTP ${response.status}`,
      );
    }

    let body: GoogleDistanceMatrixResponse;
    try {
      body = (await response.json()) as GoogleDistanceMatrixResponse;
    } catch (error) {
      throw new DistanceProviderError(
        "Distance provider returned an invalid response body",
        error,
      );
    }

    if (body.status !== "OK") {
      throw new DistanceProviderError(
        `Distance provider error: ${body.status}`,
      );
    }

    const element = body.rows?.[0]?.elements?.[0];
    if (!element || element.status !== "OK") {
      throw new DistanceProviderError(
        `No route found between origin and destination (${element?.status ?? "unknown"})`,
      );
    }

    if (!element.distance || !element.duration) {
      throw new DistanceProviderError(
        "Distance provider response is missing distance/duration",
      );
    }

    return {
      distanceMeters: element.distance.value,
      durationSeconds: element.duration.value,
    };
  }
}

export function createDistanceProvider(apiKey: string): DistanceProvider {
  return new GoogleDistanceProvider(apiKey);
}
