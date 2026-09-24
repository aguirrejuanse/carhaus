"use client";

import { useMutation } from "@tanstack/react-query";
import { adminLogin } from "@/lib/services/admin";

/**
 * Admin login mutation — `retry: false` comes from the provider default:
 * retrying a login attempt silently is pointless and noisy.
 */
export function useAdminLoginMutation() {
  return useMutation({
    mutationFn: adminLogin,
    retry: false,
  });
}
