/**
 * Booking API services — thin `apiFetch` wrappers, the single place that
 * knows the HTTP contract. When the backend moves off Next.js route
 * handlers (e.g. Nest), only this file changes; hooks stay identical.
 */

import { apiFetch } from "@/lib/api-client";

export interface TripLegInput {
  origin: string;
  destination: string;
  scheduledAt: string;
}

export interface TripExtrasInput {
  snackChoice: string;
  spotifyPlaylistUrl?: string;
  acTemperatureCelsius?: number;
}

export interface QuoteLeg {
  sequence: 1 | 2;
  origin: string;
  destination: string;
  scheduledAt: string;
  priceCents: number;
}

export interface PricePreview {
  token: string;
  quote: { legs: QuoteLeg[]; totalPriceCents: number };
}

export function requestPricePreview(
  legs: TripLegInput[],
): Promise<PricePreview> {
  return apiFetch<PricePreview>("/api/pricing/preview", { body: { legs } });
}

export function submitTripRequest(input: {
  email: string;
  quoteToken?: string;
  legs: TripLegInput[];
  extras: TripExtrasInput;
}): Promise<{ publicToken: string }> {
  return apiFetch<{ publicToken: string }>("/api/trips", { body: input });
}
