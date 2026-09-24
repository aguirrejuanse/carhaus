/**
 * Places autocomplete service — thin `apiFetch` wrapper over the signed
 * same-origin proxy. The Google key never reaches the client; suggestions
 * are an enhancement only — callers degrade to free text on failure.
 */

import { apiFetch } from "@/lib/api-client";

export interface PlaceSuggestion {
  /** Google `place_id` — usable as `place_id:<id>` in Distance Matrix. */
  placeId: string;
  /** Full formatted description shown in the input ("9 de Julio 1276, …"). */
  text: string;
}

export function fetchPlaceSuggestions(
  query: string,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  return apiFetch<PlaceSuggestion[]>(
    `/api/places/autocomplete?q=${encodeURIComponent(query)}`,
    { method: "GET", signal },
  );
}
