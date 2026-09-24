/**
 * `GET /api/map/static?o=..&d=..&sig=..` — signed proxy for Google Static
 * Maps. The preview route signs the provider-resolved addresses with
 * `QUOTE_SECRET`; this handler verifies before proxying so the endpoint
 * only renders maps for routes we computed (otherwise it would be a free
 * Static Maps API on our key). Keeps `GOOGLE_MAPS_API_KEY` server-side —
 * it never appears in client markup.
 */

import { ApiError, toErrorResponse } from "@/lib/api/errors";
import { getEnv } from "@/lib/env";
import { verifyMapParams } from "@/lib/quote";
import type { NextRequest } from "next/server";

const STATIC_MAPS_ENDPOINT =
  "https://maps.googleapis.com/maps/api/staticmap";

const MAX_PARAM_LENGTH = 200;

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const origin = searchParams.get("o") ?? "";
    const destination = searchParams.get("d") ?? "";
    const signature = searchParams.get("sig") ?? "";

    if (
      !origin ||
      !destination ||
      !signature ||
      origin.length > MAX_PARAM_LENGTH ||
      destination.length > MAX_PARAM_LENGTH
    ) {
      throw new ApiError(400, "invalid_map_params", "Invalid map parameters");
    }

    const env = getEnv();
    if (!verifyMapParams(origin, destination, signature, env.QUOTE_SECRET)) {
      throw new ApiError(403, "invalid_map_signature", "Invalid map signature");
    }

    const url = new URL(STATIC_MAPS_ENDPOINT);
    url.searchParams.set("size", "640x280");
    url.searchParams.set("scale", "2");
    url.searchParams.set("style", "feature:poi|visibility:off");
    url.searchParams.append("markers", `color:0x1e1b4b|label:A|${origin}`);
    url.searchParams.append(
      "markers",
      `color:0xf5c518|label:B|${destination}`,
    );
    url.searchParams.set("key", env.GOOGLE_MAPS_API_KEY);

    const upstream = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });
    if (!upstream.ok || !upstream.body) {
      throw new ApiError(
        502,
        "map_provider_unavailable",
        "Could not render the map right now",
      );
    }

    return new Response(upstream.body, {
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "image/png",
        "cache-control": "public, max-age=3600",
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
