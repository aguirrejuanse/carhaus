/**
 * Shared Resend sender — the single place that knows the API key, the
 * default sender, and the `error`-in-result contract. Throws on missing
 * config or send failure; callers decide whether that's data (queued
 * notification → `failed`) or a request error (OTP → 503).
 */

import { Resend } from "resend";
import { getEnv } from "./env";

interface EmailAttachment {
  filename: string;
  content: string;
  contentId?: string;
}

export async function sendEmail(
  input: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    attachments?: EmailAttachment[];
  },
  options?: {
    /** Retries with the same key return the original send — callers pass
     *  a stable per-entity id (e.g. `notification/<id>`, `otp/<id>`). */
    idempotencyKey?: string;
  },
): Promise<void> {
  const env = getEnv();
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send(
    {
      from: env.RESEND_FROM ?? "Carhaus <onboarding@resend.dev>",
      ...input,
    },
    options?.idempotencyKey
      ? { idempotencyKey: options.idempotencyKey }
      : undefined,
  );

  if (error) {
    throw new Error(error.message);
  }
}
