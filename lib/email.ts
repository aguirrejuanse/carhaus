/**
 * Shared Resend sender — the single place that knows the API key, the
 * default sender, and the `error`-in-result contract. Throws on missing
 * config or send failure; callers decide whether that's data (queued
 * notification → `failed`) or a request error (OTP → 503).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
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

// ── Branded shell ──────────────────────────────────────────────────────
// Shared by every transactional email (OTP, trip resolution). Old-school
// table layout + inline styles — the only HTML email clients render
// reliably.

/** Email-HTML escape — origins/destinations/URLs are free user input. */
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Logo bytes for the inline (CID) attachment — email clients can't fetch
 * images from Deployment-Protected previews, so the logo travels inside
 * the email. `undefined` until first read; `null` when the file isn't
 * bundled (e.g. missing from function tracing).
 */
let logoBase64: string | null | undefined;
export function logoAttachment(): string | null {
  if (logoBase64 === undefined) {
    try {
      logoBase64 = readFileSync(
        path.join(process.cwd(), "public", "logo-header.png"),
      ).toString("base64");
    } catch {
      logoBase64 = null;
    }
  }
  return logoBase64;
}

/** `cid:` when the logo is attached inline, else the public URL. */
export function logoSrc(logo: string | null): string {
  return logo ? "cid:logo" : `${getEnv().APP_ORIGIN}/logo-header.png`;
}

/** Attachments array for `sendEmail` — undefined when no inline logo. */
export function logoAttachments(logo: string | null) {
  return logo
    ? [{ filename: "logo-header.png", content: logo, contentId: "logo" }]
    : undefined;
}

export interface BrandedEmail {
  /** Eyebrow color — matches TripStatusBadge accents (green/red/navy). */
  accent: string;
  eyebrow: string;
  title: string;
  /** Inner HTML for the card body — detail rows, paragraphs, the code. */
  body: string;
  cta?: { href: string; label: string };
  /** Line above the tagline — defaults to the thanks message. */
  footer?: string;
}

export function brandedEmailHtml({
  accent,
  eyebrow,
  title,
  body,
  cta,
  footer = "Gracias por viajar con nosotros.",
}: BrandedEmail): string {
  const logo = logoAttachment();

  const ctaRow = cta
    ? `<tr><td align="center" style="padding:28px 0 8px">
        <a href="${esc(cta.href)}" style="display:inline-block;background:#F5C518;color:#1E1B4B;font-size:15px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:8px">${cta.label}</a>
      </td></tr>`
    : "";

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
        <tr><td align="center" style="background:#1E1B4B;padding:24px">
          <img src="${esc(logoSrc(logo))}" alt="Carhaus" width="140" style="display:block;border:0" />
        </td></tr>
        <tr><td style="padding:32px 32px 8px">
          <p style="margin:0 0 4px;color:${accent};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">${eyebrow}</p>
          <h1 style="margin:0 0 24px;color:#1E1B4B;font-size:26px;font-weight:800">${title}</h1>
          ${body}
        </td></tr>
        ${ctaRow}
        <tr><td style="padding:24px 32px 32px;text-align:center">
          <p style="margin:0;color:#71717a;font-size:14px">${esc(footer)}</p>
          <p style="margin:4px 0 0;color:#1E1B4B;font-size:14px;font-weight:700;font-style:italic">Tu viaje, a tu medida.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
