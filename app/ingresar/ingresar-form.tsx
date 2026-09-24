"use client";

/** Standalone rider login — OTP for a returning rider; on success the
 *  session is set and we land on their trips. */

import { VerifyEmailForm } from "@/app/_components/verify-email-form";

export function IngresarForm() {
  // Full reload on purpose: the AppHeader lives in the shared root layout
  // and client-side navigation can serve its pre-login render from the
  // Router Cache (refresh()+push() races against it — verified broken).
  // Same precedent as LogoutButton's window.location.href.
  return (
    <VerifyEmailForm
      onVerified={() => window.location.assign("/viajes")}
    />
  );
}
