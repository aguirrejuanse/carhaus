/**
 * `PATCH /api/admin/trips/[id]` (spec: "Approve with Assignment",
 * "Reject Trip", "Trip Immutability"; design HTTP contract). Admin-only
 * (`mutationRoute({ admin: true })` → `requireAdmin` re-verifies the JWT
 * inside the handler — middleware is only a UX gate, design decision #4).
 *
 * Both actions run a conditional `UPDATE ... WHERE status='pending'`: 0
 * rows → `409 trip_not_pending` (covers double-approve races and any
 * mutation attempt on an already-resolved trip, which is the immutability
 * enforcement point). On approve, a `notifications` row is queued in the
 * same batch transaction; actual dispatch stays outside the transaction
 * in PR8 (design "Data Flow").
 */

import { z } from "zod";
import { approveTrip, getTripForAdmin, rejectTrip } from "@/db/queries";
import { ApiError, jsonSuccess } from "@/lib/api/errors";
import { mutationRoute } from "@/lib/api/route";
import { dispatchApprovalNotification } from "@/lib/notifications";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    carId: z.uuid(),
    driverId: z.uuid(),
  }),
  z.object({
    action: z.literal("reject"),
    reason: z.string().max(500).optional(),
  }),
]);

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export const PATCH = mutationRoute({
  schema: patchSchema,
  admin: true,
  handler: async (input, _req, ctx: RouteCtx) => {
    const { id } = await ctx.params;

    const trip = await getTripForAdmin(id);
    if (!trip) {
      throw new ApiError(404, "trip_not_found", "Trip not found");
    }

    const updated =
      input.action === "approve"
        ? await approveTrip({
            tripId: id,
            carId: input.carId,
            driverId: input.driverId,
            riderEmail: trip.user.email,
          })
        : await rejectTrip({ tripId: id, reason: input.reason });

    if (!updated) {
      throw new ApiError(
        409,
        "trip_not_pending",
        "Trip is not pending — it was already resolved",
      );
    }

    if (input.action === "approve") {
      // After commit, outside the transaction (design "Data Flow"): an
      // email can't be rolled back and a send failure must never void an
      // approval. Awaited so the serverless function doesn't freeze mid-send.
      await dispatchApprovalNotification(id);
    }

    return jsonSuccess({ trip: updated });
  },
});
