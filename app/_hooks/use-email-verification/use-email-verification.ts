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
  const [resendEndsAt, setResendEndsAt] = useState<number | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [enteredEmail, setEnteredEmail] = useState("");
  const requestedFor = useRef<string | undefined>(undefined);
  const targetEmail = lockedEmail ?? enteredEmail;

  // Deadline-based: each tick derives the remaining time from the clock,
  // so a throttled interval (backgrounded tab) can't lag behind the real
  // cooldown — the next tick just shows the true remaining seconds.
  const countdownActive = resendSeconds > 0;
  useEffect(() => {
    if (!countdownActive || resendEndsAt === null) return;
    const timer = setInterval(
      () =>
        setResendSeconds(
          Math.max(0, Math.ceil((resendEndsAt - Date.now()) / 1000)),
        ),
      1000,
    );
    return () => clearInterval(timer);
  }, [countdownActive, resendEndsAt]);

  const sendCode = (target: string) => {
    if (!target || requestOtp.isPending) return;
    verify.reset(); // a stale verify error must not survive a new send
    requestedFor.current = target;
    requestOtp.mutate(target, {
      onSuccess: () => {
        setResendEndsAt(Date.now() + RESEND_SECONDS * 1000);
        setResendSeconds(RESEND_SECONDS);
      },
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
    requestOtp.reset(); // a stale request error must not survive a verify
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
