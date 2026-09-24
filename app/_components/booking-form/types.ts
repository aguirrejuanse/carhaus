/** Types shared by the booking form hook, services, and subcomponents. */

export interface QuoteLeg {
  sequence: 1 | 2;
  origin: string;
  destination: string;
  scheduledAt: string;
  priceCents: number;
}

export interface Preview {
  token: string;
  quote: { legs: QuoteLeg[]; totalPriceCents: number };
}

export interface FormState {
  error?: string;
  fields?: Record<string, string[]>;
}

export type PreviewStatus = "idle" | "loading" | "error";

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

/** Pre-fill values from a saved template (spec: "Re-request Template" —
 * dates are never pre-filled: a re-request always re-runs the preview). */
export interface BookingInitial {
  origin: string;
  destination: string;
  roundTrip: boolean;
  snackChoice: string;
  spotifyPlaylistUrl?: string;
  acTemperatureCelsius?: number;
}
