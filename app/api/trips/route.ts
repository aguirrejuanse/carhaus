/**
 * `POST /api/trips` (spec: "Rider Trip Request", "Email-Keyed Identity",
 * "Trip Extras"; design HTTP contract). Public route — verifies the
 * HMAC-signed quote token instead of trusting a client-supplied price
 * (design decision #5), find-or-creates the rider `users` row by email,
 * persists trips + trip_legs + trip_extras in one batch transaction
 * (design decision #9), sets the `carhaus_rider` session cookie, and
 * returns the trip's `publicToken` for the `/trips/[token]` confirmation
 * page.
 *
 * When the rider never got a quote (distance provider was down — spec
 * "Distance Provider Failure Handling"), `quoteToken` may be absent and
 * the trip is persisted unpriced (0s) for admin review. A present but
 * invalid/expired token is rejected with `409 quote_invalid` so the rider
 * re-previews instead of booking a stale price.
 */

import { z } from "zod";
import {
  createTripBooking,
  upsertUserByEmail,
  type NewBookingLeg,
} from "@/db/queries";
import { SNACK_CHOICE, TRIP_TYPE, type SnackChoice } from "@/db/schema";
import { ApiError, jsonSuccess } from "@/lib/api/errors";
import { mutationRoute } from "@/lib/api/route";
import { getEnv } from "@/lib/env";
import { verifyQuote } from "@/lib/quote";
import {
  RIDER_COOKIE_NAME,
  RIDER_SESSION_TTL_SECONDS,
  signRiderSession,
} from "@/lib/rider";

const snackValues = Object.values(SNACK_CHOICE) as [SnackChoice, ...SnackChoice[]];

const legSchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  /** ISO 8601 timestamp of when the leg departs. */
  scheduledAt: z.iso.datetime(),
});

const bookingSchema = z.object({
  email: z.email(),
  /** Signed quote from `POST /api/pricing/preview`; absent only when the
   *  distance provider was unavailable (see module docstring). */
  quoteToken: z.string().optional(),
  /** Client echoes the legs it previewed; the signed quote is the source
   *  of truth for persisted distance/duration/price when present. */
  legs: z.array(legSchema).min(1).max(2),
  extras: z
    .object({
      snackChoice: z.enum(snackValues).default(SNACK_CHOICE.NONE),
      spotifyPlaylistUrl: z.url().optional(),
      acTemperatureCelsius: z.number().int().min(16).max(30).optional(),
    })
    .default({ snackChoice: SNACK_CHOICE.NONE }),
});

export const POST = mutationRoute({
  schema: bookingSchema,
  handler: async (input) => {
    const env = getEnv();

    let legs: NewBookingLeg[];
    let totalPriceCents: number;

    if (input.quoteToken) {
      let quote;
      try {
        quote = verifyQuote(input.quoteToken, env.QUOTE_SECRET);
      } catch {
        throw new ApiError(
          409,
          "quote_invalid",
          "The price quote is invalid or expired — request a new preview",
        );
      }
      legs = quote.legs.map((leg) => ({
        ...leg,
        scheduledAt: new Date(leg.scheduledAt),
      }));
      totalPriceCents = quote.totalPriceCents;
    } else {
      legs = input.legs.map((leg, index) => ({
        sequence: index + 1,
        origin: leg.origin,
        destination: leg.destination,
        scheduledAt: new Date(leg.scheduledAt),
        distanceMeters: 0,
        durationSeconds: 0,
        priceCents: 0,
      }));
      totalPriceCents = 0;
    }

    const user = await upsertUserByEmail(input.email);
    const trip = await createTripBooking({
      userId: user.id,
      tripType: legs.length === 2 ? TRIP_TYPE.ROUND_TRIP : TRIP_TYPE.ONE_WAY,
      totalPriceCents,
      legs,
      extras: input.extras,
    });

    const riderToken = await signRiderSession(user.id);
    const res = jsonSuccess({ publicToken: trip.publicToken }, 201);
    res.headers.append(
      "set-cookie",
      `${RIDER_COOKIE_NAME}=${riderToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${RIDER_SESSION_TTL_SECONDS}${
        process.env.NODE_ENV === "production" ? "; Secure" : ""
      }`,
    );
    return res;
  },
});
