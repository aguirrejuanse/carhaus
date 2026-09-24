/**
 * Shared Zod building blocks for the public API — the leg/extras shapes
 * are identical across routes (preview, booking, templates), so they
 * live here instead of being re-declared per route.
 */

import { z } from "zod";
import { SNACK_CHOICE, type SnackChoice } from "@/db/schema";

const snackValues = Object.values(SNACK_CHOICE) as [
  SnackChoice,
  ...SnackChoice[],
];

/** Free-text address cap — Places suggestions are way shorter anyway. */
const MAX_PLACE_TEXT = 200;
/** Bookings can't be for the past, and a year out is generous enough. */
const MAX_BOOKING_HORIZON_MS = 366 * 24 * 60 * 60 * 1000;

/** A trip leg as the client describes it — exactly 1–2 legs per MVP. */
export const legSchema = z.object({
  origin: z.string().min(1).max(MAX_PLACE_TEXT),
  destination: z.string().min(1).max(MAX_PLACE_TEXT),
  /** ISO 8601 timestamp of when the leg departs. */
  scheduledAt: z.iso
    .datetime()
    .refine((value) => new Date(value).getTime() > Date.now(), {
      message: "La fecha tiene que ser futura",
    })
    .refine(
      (value) =>
        new Date(value).getTime() < Date.now() + MAX_BOOKING_HORIZON_MS,
      { message: "La fecha no puede ser a más de un año" },
    ),
  /** Google `place_id`s when the rider picked an autocomplete suggestion —
   *  lets the preview route query Distance Matrix by exact place instead
   *  of re-geocoding ambiguous free text. Never persisted. */
  originPlaceId: z.string().optional(),
  destinationPlaceId: z.string().optional(),
});

/** The shared 1–2 leg array: ordering is a cross-leg rule, so it lives on
 *  the array (the client's `min` on the return input is just UX). */
export const legsSchema = z
  .array(legSchema)
  .min(1)
  .max(2)
  .refine(
    (legs) =>
      !legs[1] ||
      new Date(legs[1].scheduledAt) > new Date(legs[0].scheduledAt),
    { message: "La vuelta tiene que ser después de la ida" },
  );

export const extrasSchema = z
  .object({
    snackChoice: z.enum(snackValues).default(SNACK_CHOICE.NONE),
    spotifyPlaylistUrl: z
      .url()
      .refine(
        (value) => new URL(value).hostname.endsWith("spotify.com"),
        { message: "Tiene que ser un link de Spotify" },
      )
      .optional(),
    acTemperatureCelsius: z.number().int().min(16).max(30).optional(),
  })
  .default({ snackChoice: SNACK_CHOICE.NONE });
