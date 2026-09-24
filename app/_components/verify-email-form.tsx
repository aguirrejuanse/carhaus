"use client";

/**
 * Email OTP step — shared by the booking flow (post-submit verification)
 * and `/ingresar` (standalone login for returning riders). Two stages:
 * request the code (auto-fired when `email` is locked in by the caller)
 * then verify it; a 30 s resend cooldown mirrors the server one.
 */

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/errors";
import { useRequestOtpMutation } from "@/app/_hooks/use-request-otp-mutation";
import { useVerifyOtpMutation } from "@/app/_hooks/use-verify-otp-mutation";

const RESEND_SECONDS = 30;

interface Props {
  /** When set, the email is fixed (booking already collected it) and the
   *  code request fires on mount. When absent, an email field is shown. */
  email?: string;
  onVerified: (email: string) => void;
}

export function VerifyEmailForm({ email, onVerified }: Props) {
  const requestOtp = useRequestOtpMutation();
  const verify = useVerifyOtpMutation();
  const [resendSeconds, setResendSeconds] = useState(0);
  const [enteredEmail, setEnteredEmail] = useState("");
  const requestedFor = useRef<string | undefined>(undefined);
  const targetEmail = email ?? enteredEmail;

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setInterval(
      () => setResendSeconds((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [resendSeconds]);

  const sendCode = (target: string) => {
    if (!target || requestOtp.isPending) return;
    requestedFor.current = target;
    requestOtp.mutate(target, { onSuccess: () => setResendSeconds(RESEND_SECONDS) });
  };

  // Locked-in email (booking flow) → code goes out on mount.
  useEffect(() => {
    if (email && requestedFor.current !== email) sendCode(email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

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

  const codeSent = requestOtp.isSuccess || Boolean(email);
  const error =
    requestOtp.error instanceof ApiError
      ? requestOtp.error.message
      : verify.error instanceof ApiError
        ? verify.error.message
        : requestOtp.isError || verify.isError
          ? "Algo salió mal. Probá de nuevo."
          : null;

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="verify-email">Email</FieldLabel>
        <Input
          id="verify-email"
          name="email"
          type="email"
          required
          defaultValue={email}
          readOnly={Boolean(email)}
          onChange={(e) => setEnteredEmail(e.target.value)}
          placeholder="vos@ejemplo.com"
          autoComplete="email"
        />
      </Field>

      {codeSent && (
        <Field>
          <FieldLabel htmlFor="verify-code">Código</FieldLabel>
          <Input
            id="verify-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
          />
          <FieldDescription>
            Te mandamos un código de 6 dígitos — vence en 10 minutos.
          </FieldDescription>
        </Field>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={requestOtp.isPending || verify.isPending}
        >
          {codeSent
            ? verify.isPending
              ? "Verificando…"
              : "Verificar"
            : requestOtp.isPending
              ? "Enviando…"
              : "Enviar código"}
        </Button>
        {codeSent && (
          <button
            type="button"
            onClick={() => sendCode(targetEmail)}
            disabled={resendSeconds > 0 || requestOtp.isPending}
            className="text-sm text-muted-foreground underline-offset-2 hover:underline disabled:no-underline disabled:opacity-50"
          >
            {resendSeconds > 0
              ? `Reenviar en ${resendSeconds}s`
              : "Reenviar código"}
          </button>
        )}
      </div>
    </form>
  );
}
