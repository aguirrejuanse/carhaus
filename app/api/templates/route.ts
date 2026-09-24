/**
 * `/api/templates` (spec: "Save Recurring Template", "Session-Scoped
 * Template Listing"; design HTTP contract). Rider auth = the
 * `carhaus_rider` cookie set by `POST /api/trips` (design decision #7) —
 * templates are keyed by rider email, resolved from the session.
 *
 * - `POST` is a mutation → `mutationRoute` (origin → zod → handler). No
 *   session → `401 unauthorized` (a template can't be linked to anyone).
 * - `GET` is a plain handler — `assertSameOrigin` can't apply (browsers
 *   don't send `Origin` on same-origin GETs). No session → `200
 *   {templates: []}`: anonymous riders simply have no templates; the
 *   cross-session ownership guard is a documented phase-2 gap (spec).
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { createTemplate, listTemplatesByRiderEmail } from "@/db/queries";
import { TRIP_TYPE } from "@/db/schema";
import { ApiError, jsonSuccess } from "@/lib/api/errors";
import { mutationRoute } from "@/lib/api/route";
import { extrasSchema } from "@/lib/api/schemas";
import { RIDER_COOKIE_NAME, riderFromCookieValue } from "@/lib/rider";

const templateSchema = z.object({
  name: z.string().min(1).max(100),
  // Legs carry no scheduledAt/price — a re-request always re-runs the
  // price preview (spec: "Re-request Template").
  legs: z
    .array(
      z.object({
        origin: z.string().min(1).max(200),
        destination: z.string().min(1).max(200),
      }),
    )
    .min(1)
    .max(2),
  extras: extrasSchema,
});

async function riderFromRequest(req: NextRequest) {
  return await riderFromCookieValue(req.cookies.get(RIDER_COOKIE_NAME)?.value);
}

export const POST = mutationRoute({
  schema: templateSchema,
  handler: async (input, req) => {
    const rider = await riderFromRequest(req);
    if (!rider) {
      throw new ApiError(
        401,
        "unauthorized",
        "A booking session is required to save a template",
      );
    }

    const template = await createTemplate({
      riderEmail: rider.email,
      name: input.name,
      tripType:
        input.legs.length === 2 ? TRIP_TYPE.ROUND_TRIP : TRIP_TYPE.ONE_WAY,
      legs: input.legs.map((leg, index) => ({
        sequence: (index + 1) as 1 | 2,
        origin: leg.origin,
        destination: leg.destination,
      })),
      ...input.extras,
    });

    return jsonSuccess({ template }, 201);
  },
});

export async function GET(req: NextRequest) {
  const rider = await riderFromRequest(req);
  const templates = rider
    ? await listTemplatesByRiderEmail(rider.email)
    : [];
  return jsonSuccess({ templates });
}
