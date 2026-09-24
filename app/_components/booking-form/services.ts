/**
 * Client-side API services for the booking flow — thin `apiFetch`
 * wrappers so the hook never builds request payloads inline.
 */

import { apiFetch } from "@/lib/api-client";
import type { Preview, TripExtrasInput, TripLegInput } from "./types";

export function requestPricePreview(legs: TripLegInput[]): Promise<Preview> {
  return apiFetch<Preview>("/api/pricing/preview", { body: { legs } });
}

export function submitTripRequest(input: {
  email: string;
  quoteToken?: string;
  legs: TripLegInput[];
  extras: TripExtrasInput;
}): Promise<{ publicToken: string }> {
  return apiFetch<{ publicToken: string }>("/api/trips", { body: input });
}
