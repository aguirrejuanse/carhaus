/** Types shared by the booking form hook and subcomponents. */

/** Per-field validation errors from a `422` API response. */
export type FieldErrors = Record<string, string[]> | undefined;

export type PreviewStatus = "idle" | "loading" | "error";

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
