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

/** A trip leg as the client describes it — exactly 1–2 legs per MVP. */
export const legSchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  /** ISO 8601 timestamp of when the leg departs. */
  scheduledAt: z.iso.datetime(),
});

export const extrasSchema = z
  .object({
    snackChoice: z.enum(snackValues).default(SNACK_CHOICE.NONE),
    spotifyPlaylistUrl: z.url().optional(),
    acTemperatureCelsius: z.number().int().min(16).max(30).optional(),
  })
  .default({ snackChoice: SNACK_CHOICE.NONE });
