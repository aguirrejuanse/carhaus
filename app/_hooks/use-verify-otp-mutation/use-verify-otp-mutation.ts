"use client";

/** POST /api/auth/verify — checks the code and sets the rider session
 *  cookie. Side-effecting: never retried. */

import { useMutation } from "@tanstack/react-query";
import { verifyEmailCode } from "@/lib/services/auth";

export function useVerifyOtpMutation() {
  return useMutation({
    mutationFn: (input: { email: string; code: string }) =>
      verifyEmailCode(input.email, input.code),
    retry: false,
  });
}
