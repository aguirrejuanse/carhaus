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
import { createTripBooking, type NewBookingLeg } from "@/db/queries";
import { TRIP_TYPE } from "@/db/schema";
import { ApiError, jsonSuccess } from "@/lib/api/errors";
import { mutationRoute } from "@/lib/api/route";
import { extrasSchema, legSchema } from "@/lib/api/schemas";
import { getEnv } from "@/lib/env";
import { verifyQuote } from "@/lib/quote";
import { RIDER_COOKIE_NAME, riderFromCookieValue } from "@/lib/rider";

const bookingSchema = z.object({
  /** Signed quote from `POST /api/pricing/preview`; absent only when the
   *  distance provider was unavailable (see module docstring). */
  quoteToken: z.string().optional(),
  /** Client echoes the legs it previewed; the signed quote is the source
   *  of truth for persisted distance/duration/price when present. */
  legs: z.array(legSchema).min(1).max(2),
  extras: extrasSchema,
});

export const POST = mutationRoute({
  schema: bookingSchema,
  handler: async (input, req) => {
    // Booking requires a verified email — `POST /api/auth/verify` is the
    // only issuer of the rider session. Without it the trip never reaches
    // the admin queue (spec: booking verification).
    const rider = await riderFromCookieValue(
      req.cookies.get(RIDER_COOKIE_NAME)?.value,
    );
    if (!rider) {
      throw new ApiError(
        401,
        "unauthorized",
        "Verificá tu email para pedir el viaje",
      );
    }

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

    const trip = await createTripBooking({
      userId: rider.userId,
      tripType: legs.length === 2 ? TRIP_TYPE.ROUND_TRIP : TRIP_TYPE.ONE_WAY,
      totalPriceCents,
      legs,
      extras: input.extras,
    });

    return jsonSuccess({ publicToken: trip.publicToken }, 201);
  },
});
