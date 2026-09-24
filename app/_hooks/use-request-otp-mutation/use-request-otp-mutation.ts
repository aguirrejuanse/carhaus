"use client";

/** POST /api/auth/otp — sends a 6-digit verification code to the email. */

import { useMutation } from "@tanstack/react-query";
import { requestEmailCode } from "@/lib/services/auth";

export function useRequestOtpMutation() {
  return useMutation({
    mutationFn: (email: string) => requestEmailCode(email),
    retry: false,
  });
}
