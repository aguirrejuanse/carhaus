"use client";

/**
 * Email OTP step — shared by the booking flow (post-submit verification)
 * and `/ingresar` (standalone login for returning riders). State lives in
 * `useEmailVerification`; this file is pure rendering.
 */

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useEmailVerification } from "@/app/_hooks/use-email-verification";
import { CodeField } from "./code-field";
import { ResendButton } from "./resend-button";

interface Props {
  /** When set, the email is fixed (booking already collected it) and the
   *  code request fires on mount. When absent, an email field is shown. */
  email?: string;
  onVerified: (email: string) => void;
}

export function VerifyEmailForm({ email, onVerified }: Props) {
  const {
    setEnteredEmail,
    codeSent,
    error,
    resendSeconds,
    requestPending,
    verifyPending,
    resend,
    onSubmit,
  } = useEmailVerification(email, onVerified);

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

      {codeSent && <CodeField />}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={requestPending || verifyPending}>
          {codeSent
            ? verifyPending
              ? "Verificando…"
              : "Verificar"
            : requestPending
              ? "Enviando…"
              : "Enviar código"}
        </Button>
        {codeSent && (
          <ResendButton
            secondsLeft={resendSeconds}
            pending={requestPending}
            onResend={resend}
          />
        )}
      </div>
    </form>
  );
}
