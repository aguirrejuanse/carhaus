"use client";

/**
 * State machine behind `VerifyEmailForm` — owns the request/verify
 * mutations, the resend countdown (mirrors the 60 s server cooldown in
 * lib/otp.ts), and the "send code vs verify code" submit switch.
 */

import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/errors";
import { useRequestOtpMutation } from "@/app/_hooks/use-request-otp-mutation";
import { useVerifyOtpMutation } from "@/app/_hooks/use-verify-otp-mutation";

const RESEND_SECONDS = 60;

export function useEmailVerification(
  lockedEmail: string | undefined,
  onVerified: (email: string) => void,
) {
  const requestOtp = useRequestOtpMutation();
  const verify = useVerifyOtpMutation();
  const [resendSeconds, setResendSeconds] = useState(0);
  const [enteredEmail, setEnteredEmail] = useState("");
  const requestedFor = useRef<string | undefined>(undefined);
  const targetEmail = lockedEmail ?? enteredEmail;

  const countdownActive = resendSeconds > 0;
  useEffect(() => {
    if (!countdownActive) return;
    const timer = setInterval(
      () => setResendSeconds((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [countdownActive]);

  const sendCode = (target: string) => {
    if (!target || requestOtp.isPending) return;
    requestedFor.current = target;
    requestOtp.mutate(target, {
      onSuccess: () => setResendSeconds(RESEND_SECONDS),
    });
  };

  // Locked-in email (booking flow) → code goes out on mount.
  useEffect(() => {
    if (lockedEmail && requestedFor.current !== lockedEmail)
      sendCode(lockedEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedEmail]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = String(
      new FormData(event.currentTarget).get("code") ?? "",
    ).trim();
    if (!code) {
      // No code yet → this submit is the "send me a code" step.
      sendCode(targetEmail);
      return;
    }
    verify.mutate(
      { email: targetEmail, code },
      { onSuccess: () => onVerified(targetEmail) },
    );
  };

  const error =
    requestOtp.error instanceof ApiError
      ? requestOtp.error.message
      : verify.error instanceof ApiError
        ? verify.error.message
        : requestOtp.isError || verify.isError
          ? "Algo salió mal. Probá de nuevo."
          : null;

  return {
    targetEmail,
    setEnteredEmail,
    codeSent: requestOtp.isSuccess || Boolean(lockedEmail),
    error,
    resendSeconds,
    requestPending: requestOtp.isPending,
    verifyPending: verify.isPending,
    resend: () => sendCode(targetEmail),
    onSubmit,
  };
}
