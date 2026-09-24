/**
 * Auth API services — single place that knows the HTTP contract for the
 * email OTP endpoints (`POST /api/auth/otp`, `POST /api/auth/verify`).
 */

import { apiFetch } from "@/lib/api-client";

export function requestEmailCode(email: string): Promise<{ sent: boolean }> {
  return apiFetch("/api/auth/otp", { body: { email } });
}

export function verifyEmailCode(
  email: string,
  code: string,
): Promise<{ email: string }> {
  return apiFetch("/api/auth/verify", { body: { email, code } });
}
