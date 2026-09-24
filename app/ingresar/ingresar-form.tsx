"use client";

/** Standalone rider login — OTP for a returning rider; on success the
 *  session is set and we land on their trips. */

import { useRouter } from "next/navigation";
import { VerifyEmailForm } from "@/app/_components/verify-email-form";

export function IngresarForm() {
  const router = useRouter();
  // refresh() before push — the server-component header would otherwise
  // keep the pre-login "Ingresar" link from the cached layout.
  return (
    <VerifyEmailForm
      onVerified={() => {
        router.refresh();
        router.push("/viajes");
      }}
    />
  );
}
