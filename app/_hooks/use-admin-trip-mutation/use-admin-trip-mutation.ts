"use client";

import { useMutation } from "@tanstack/react-query";
import { adminUpdateTrip, type AdminTripAction } from "@/lib/services/admin";

/**
 * Approve/reject mutation for the admin trip detail. `retry: false` comes
 * from the provider default — a silent retry could double-submit an
 * approval (the server also guards with `409 trip_not_pending`).
 */
export function useAdminTripMutation(tripId: string) {
  return useMutation({
    mutationFn: (input: AdminTripAction) => adminUpdateTrip(tripId, input),
    retry: false,
  });
}
