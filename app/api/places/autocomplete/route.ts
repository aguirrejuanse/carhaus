/**
 * `GET /api/places/autocomplete?q=…` — proxy for Google Places
 * Autocomplete (New). Keeps `GOOGLE_MAPS_API_KEY` server-side and owns
 * the request shaping (Argentina restriction + Mendoza bias + Spanish)
 * so the client sends only the raw query.
 *
 * Abuse surface is deliberately narrow: `sec-fetch-site` must be
 * same-origin/same-site (Fetch Metadata — the GET equivalent of the
 * mutation same-origin guard, since GETs don't carry an `Origin`
 * header), and the query is length-capped. Billing stays inside the
 * Essentials free tier (10k requests/mo) at MVP volume; the client
 * also debounces and aborts stale requests.
 */

import { ApiError, jsonSuccess, toErrorResponse } from "@/lib/api/errors";
import { getEnv } from "@/lib/env";
import type { NextRequest } from "next/server";

const AUTOCOMPLETE_ENDPOINT =
  "https://places.googleapis.com/v1/places:autocomplete";

/** Carhaus operates out of Mendoza — results are biased (not restricted)
 *  to a 200 km circle so local addresses outrank same-named CABA ones,
 *  while `includedRegionCodes` keeps everything inside Argentina. */
const MENDOZA_BIAS = {
  circle: {
    center: { latitude: -32.8895, longitude: -68.8458 },
    radius: 200_000,
  },
};

const MIN_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 120;

interface PlacesAutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
    };
  }>;
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const fetchSite = req.headers.get("sec-fetch-site");
    if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
      throw new ApiError(403, "forbidden", "Cross-site requests are not allowed");
    }

    const query = (new URL(req.url).searchParams.get("q") ?? "").trim();
    if (query.length < MIN_QUERY_LENGTH || query.length > MAX_QUERY_LENGTH) {
      return jsonSuccess([]);
    }

    const upstream = await fetch(AUTOCOMPLETE_ENDPOINT, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": getEnv().GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text",
      },
      body: JSON.stringify({
        input: query,
        includedRegionCodes: ["ar"],
        languageCode: "es",
        locationBias: MENDOZA_BIAS,
      }),
    });

    if (!upstream.ok) {
      throw new ApiError(
        502,
        "places_provider_unavailable",
        "Could not fetch place suggestions right now",
      );
    }

    const body = (await upstream.json()) as PlacesAutocompleteResponse;
    const suggestions = (body.suggestions ?? [])
      .map((s) => ({
        placeId: s.placePrediction?.placeId ?? "",
        text: s.placePrediction?.text?.text ?? "",
      }))
      .filter((s) => s.placeId && s.text);

    return jsonSuccess(suggestions);
  } catch (error) {
    return toErrorResponse(error);
  }
}
