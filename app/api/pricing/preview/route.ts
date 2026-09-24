/**
 * `POST /api/pricing/preview` (spec: "Price Preview", design HTTP contract).
 * Public route — computes a per-leg price using real driving
 * distance/duration and the active `pricing_rules` row, then returns the
 * quote plus an HMAC-signed token that `POST /api/trips` verifies instead
 * of trusting a client-supplied price (design decision #5).
 */

import { z } from "zod";
import { getActivePricingRules } from "@/db/queries";
import { ApiError, jsonSuccess } from "@/lib/api/errors";
import { mutationRoute } from "@/lib/api/route";
import {
  DistanceProviderError,
  GoogleDistanceProvider,
} from "@/lib/distance";
import { getEnv } from "@/lib/env";
import { priceTrip } from "@/lib/pricing";
import { createQuoteExpiry, signQuote, type QuotePayload } from "@/lib/quote";

const previewSchema = z.object({
  // Exactly 1 or 2 fixed legs (ida/vuelta) per MVP scope decision.
  legs: z
    .array(
      z.object({
        origin: z.string().min(1),
        destination: z.string().min(1),
        /** ISO 8601 timestamp of when the leg departs. */
        scheduledAt: z.iso.datetime(),
      }),
    )
    .min(1)
    .max(2),
});

export const POST = mutationRoute({
  schema: previewSchema,
  handler: async (input) => {
    const env = getEnv();
    const provider = new GoogleDistanceProvider(env.GOOGLE_MAPS_API_KEY);
    const rules = await getActivePricingRules();

    try {
      const legs = await Promise.all(
        input.legs.map(async (leg, index) => {
          const { distanceMeters, durationSeconds } =
            await provider.getDistance(leg.origin, leg.destination);
          return {
            sequence: (index + 1) as 1 | 2,
            origin: leg.origin,
            destination: leg.destination,
            scheduledAt: leg.scheduledAt,
            distanceMeters,
            durationSeconds,
          };
        }),
      );

      const priced = priceTrip(
        legs.map((leg) => ({
          distanceMeters: leg.distanceMeters,
          durationSeconds: leg.durationSeconds,
          scheduledAt: new Date(leg.scheduledAt),
        })),
        rules,
      );

      const quote: QuotePayload = {
        legs: legs.map((leg, index) => ({
          ...leg,
          priceCents: priced.legs[index].priceCents,
        })),
        totalPriceCents: priced.totalPriceCents,
        exp: createQuoteExpiry(),
      };

      return jsonSuccess({ quote, token: signQuote(quote, env.QUOTE_SECRET) });
    } catch (error) {
      if (error instanceof DistanceProviderError) {
        // Spec: "Distance Provider Failure Handling" — a provider outage
        // maps to 502 per the HTTP contract; the rider can still submit
        // the trip for admin review without a confirmed price.
        throw new ApiError(
          502,
          "distance_provider_unavailable",
          "Could not compute a price preview right now",
        );
      }
      throw error;
    }
  },
});
