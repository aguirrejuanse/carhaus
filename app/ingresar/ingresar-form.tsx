"use client";

/** Standalone rider login — OTP for a returning rider; on success the
 *  session is set and we land on their trips. */

import { useRouter } from "next/navigation";
import { VerifyEmailForm } from "@/app/_components/verify-email-form";

export function IngresarForm() {
  const router = useRouter();
  return <VerifyEmailForm onVerified={() => router.push("/viajes")} />;
}
