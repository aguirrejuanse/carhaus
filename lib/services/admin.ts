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
