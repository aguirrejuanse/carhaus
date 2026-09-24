/**
 * Email OTP ("verify at booking" — the rider proves ownership of the email
 * before a trip enters the admin queue; spec: booking verification).
 *
 * - 6-digit codes, HMAC-SHA256 hashed with JWT_SECRET+email — a DB leak
 *   doesn't reveal codes and a code only works for its own email.
 * - One active code per email: requesting a new one replaces the previous
 *   (`replaceVerificationCode`). Expiry 10 min, max 5 verify attempts,
 *   60 s resend cooldown.
 * - Successful verify upserts the rider `users` row — the email IS the
 *   identity (no accounts/passwords).
 */

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import {
  bumpVerificationAttempts,
  countRecentVerificationRequests,
  deleteVerificationCode,
  getLatestVerificationCode,
  replaceVerificationCode,
  upsertUserByEmail,
} from "@/db/queries";
import { ApiError } from "./api/errors";
import {
  brandedEmailHtml,
  logoAttachment,
  logoAttachments,
  sendEmail,
} from "./email";
import { getEnv } from "./env";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_IP_WINDOW_MS = 60 * 60 * 1000;
const OTP_IP_MAX_REQUESTS = 20;

function hashCode(email: string, code: string): string {
  return createHmac("sha256", getEnv().JWT_SECRET)
    .update(`${email}:${code}`)
    .digest("hex");
}

/**
 * Issues a fresh code for `email` and sends it. Throws `429` inside the
 * resend cooldown or past the per-IP request cap; Resend/config failures
 * surface as generic 503.
 */
export async function requestEmailCode(
  email: string,
  requestIp?: string,
): Promise<void> {
  if (
    requestIp &&
    (await countRecentVerificationRequests(requestIp, OTP_IP_WINDOW_MS)) >=
      OTP_IP_MAX_REQUESTS
  ) {
    throw new ApiError(
      429,
      "otp_ip_limited",
      "Demasiadas solicitudes — probá más tarde",
    );
  }

  const existing = await getLatestVerificationCode(email);
  if (
    existing &&
    Date.now() - existing.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS
  ) {
    throw new ApiError(
      429,
      "otp_cooldown",
      "Ya te enviamos un código — esperá un minuto y revisá el spam",
    );
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const row = await replaceVerificationCode({
    email,
    codeHash: hashCode(email, code),
    requestIp,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  const logo = logoAttachment();
  try {
    await sendEmail(
      {
        to: email,
        subject: `${code} es tu código Carhaus`,
        text: `Tu código de verificación Carhaus es ${code}. Vence en 10 minutos.`,
        html: brandedEmailHtml({
          accent: "#1E1B4B",
          eyebrow: "Código de verificación",
          title: "Tu código Carhaus",
          body: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <p style="margin:0;color:#71717a;font-size:14px">Ingresalo para confirmar tu viaje:</p>
            <p style="margin:20px 0;color:#1E1B4B;font-size:36px;font-weight:800;letter-spacing:8px">${code}</p>
            <p style="margin:0;color:#71717a;font-size:12px">Vence en 10 minutos.</p>
          </td></tr></table>`,
          footer: "Si no pediste este código, ignorá este email.",
        }),
        attachments: logoAttachments(logo),
      },
      { idempotencyKey: `otp/${row?.id ?? crypto.randomUUID()}` },
    );
  } catch (error) {
    // A failed send must not leave a live row — it would lock the rider
    // out for the cooldown with a code they never received.
    if (row) await deleteVerificationCode(row.id).catch(() => {});
    throw new ApiError(
      503,
      "otp_send_failed",
      error instanceof Error ? error.message : "Email send failed",
    );
  }
}

/**
 * Verifies `code` for `email`; on success upserts the rider user and
 * returns it. Throws `401` invalid/expired code, `429` after max attempts.
 */
export async function verifyEmailCode(email: string, code: string) {
  const row = await getLatestVerificationCode(email);
  if (!row || row.expiresAt.getTime() < Date.now()) {
    throw new ApiError(
      401,
      "otp_invalid",
      "El código es incorrecto o venció — pedí uno nuevo",
    );
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    throw new ApiError(
      429,
      "otp_locked",
      "Demasiados intentos — pedí un código nuevo",
    );
  }

  const expected = Buffer.from(row.codeHash, "utf8");
  const actual = Buffer.from(hashCode(email, code), "utf8");
  if (!timingSafeEqual(expected, actual)) {
    await bumpVerificationAttempts(row.id);
    throw new ApiError(401, "otp_invalid", "El código es incorrecto");
  }

  await deleteVerificationCode(row.id);
  return await upsertUserByEmail(email);
}
