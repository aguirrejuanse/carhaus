/**
 * Admin API services — thin `apiFetch` wrappers, the single place that
 * knows the admin HTTP contract. Same convention as booking/places.
 */

import { apiFetch } from "@/lib/api-client";

export function adminLogin(input: {
  email: string;
  password: string;
}): Promise<{ email: string }> {
  return apiFetch<{ email: string }>("/api/admin/login", { body: input });
}

export type AdminTripAction =
  | { action: "approve"; carId: string; driverId: string }
  | { action: "reject"; reason?: string };

export function adminUpdateTrip(
  tripId: string,
  input: AdminTripAction,
): Promise<{ trip: { status: string } }> {
  return apiFetch<{ trip: { status: string } }>(`/api/admin/trips/${tripId}`, {
    method: "PATCH",
    body: input,
  });
}
