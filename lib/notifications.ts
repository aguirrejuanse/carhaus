/**
 * Trip notifications (spec: "Approval Email", "WhatsApp Deep Link";
 * design "Data Flow"). Dispatch happens AFTER the approval transaction
 * commits — an email cannot be rolled back, and a send failure must never
 * void an approval, so `dispatchApprovalNotification` never throws; it
 * marks the queued `notifications` row `sent` or `failed` (with the error
 * message) instead.
 *
 * WhatsApp is a `wa.me` deep link only — no Twilio/WhatsApp Business API
 * in the MVP (spec Non-Goals).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import {
  getPendingEmailNotification,
  getTripForAdmin,
  markNotificationFailed,
  markNotificationSent,
} from "@/db/queries";
import { sendEmail } from "./email";
import { formatCents, formatLegDateTime } from "./format";
import { SNACK_LABELS } from "./labels";
import { getEnv } from "./env";

/** Minimal trip shape the notification copy needs — keeps callers loose. */
interface TripContactInfo {
  status: string;
  rejectionReason?: string | null;
  legs: Array<{
    sequence: number;
    origin: string;
    destination: string;
    scheduledAt: Date;
  }>;
  totalPriceCents: number;
  extras?: {
    snackChoice: string;
    spotifyPlaylistUrl: string | null;
    acTemperatureCelsius: number | null;
  } | null;
  assignedDriver?: { name: string; phone: string } | null;
  assignedCar?: { make: string; model: string; plate: string } | null;
}

/**
 * `wa.me` deep link (spec: "WhatsApp Deep Link"). `wa.me` requires digits
 * only — spaces/dashes/`+` are stripped.
 */
export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * Pre-filled WhatsApp message with trip context (spec scenario), shared
 * by the rider confirmation page and the admin detail so both render the
 * same text.
 */
export function tripWhatsAppMessage(trip: TripContactInfo): string {
  const firstLeg = trip.legs[0];
  return `Hola! Consulta por el viaje Carhaus: ${firstLeg.origin} → ${firstLeg.destination}, ${formatLegDateTime(firstLeg.scheduledAt)}.`;
}

/**
 * wa.me link for a trip: assigned driver's phone first, falling back to
 * `OPERATOR_WHATSAPP_NUMBER` (design decision #6). `null` when neither
 * exists — callers just don't render the link.
 */
export function whatsAppLinkForTrip(trip: TripContactInfo): string | null {
  const phone = trip.assignedDriver?.phone ?? getEnv().OPERATOR_WHATSAPP_NUMBER;
  if (!phone) return null;
  return buildWhatsAppLink(phone, tripWhatsAppMessage(trip));
}

/** Per-status email identity — matches TripStatusBadge colors. A future
 *  "completed" status slots in here (e.g. blue accent). */
const EMAIL_STATUS: Record<
  string,
  { accent: string; eyebrow: string; title: string; subject: string }
> = {
  approved: {
    accent: "#059669",
    eyebrow: "Viaje confirmado",
    title: "Tu viaje quedó confirmado",
    subject: "Tu viaje Carhaus fue confirmado",
  },
  rejected: {
    accent: "#dc2626",
    eyebrow: "Viaje no disponible",
    title: "No pudimos tomar este viaje",
    subject: "No pudimos tomar tu viaje Carhaus",
  },
};

function legSummary(trip: TripContactInfo): string {
  return trip.legs
    .map(
      (leg) =>
        `${leg.sequence === 1 ? "Ida" : "Vuelta"}: ${leg.origin} → ${leg.destination} — ${formatLegDateTime(leg.scheduledAt)}`,
    )
    .join("\n");
}

function resolutionEmailText(trip: TripContactInfo): string {
  const status = EMAIL_STATUS[trip.status];
  const waLink = whatsAppLinkForTrip(trip);

  if (trip.status === "approved") {
    const assignment =
      trip.assignedCar && trip.assignedDriver
        ? `Auto: ${trip.assignedCar.make} ${trip.assignedCar.model} (${trip.assignedCar.plate}) · Chofer: ${trip.assignedDriver.name}`
        : "";
    const wa = waLink ? `\n\nCoordiná con tu chofer: ${waLink}` : "";
    return `${status.title}.\n\n${legSummary(trip)}\n\nPrecio: ${formatCents(trip.totalPriceCents)}\n${assignment}${wa}`;
  }

  const reason = trip.rejectionReason ? `\n\nMotivo: ${trip.rejectionReason}` : "";
  const wa = waLink ? `\n\nConsultanos por alternativas: ${waLink}` : "";
  return `${status.title}.\n\n${legSummary(trip)}${reason}${wa}\n\nGracias por viajar con nosotros.`;
}

/** Email-HTML escape — origins/destinations/URLs are free user input. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #e4e4e7;color:#71717a;font-size:13px;vertical-align:top;width:110px">${label}</td>
    <td style="padding:10px 0;border-bottom:1px solid #e4e4e7;color:#1E1B4B;font-size:15px;font-weight:600;text-align:right">${value}</td>
  </tr>`;
}

function legRows(trip: TripContactInfo): string[] {
  return trip.legs.flatMap((leg) => {
    const tag = leg.sequence === 1 ? "Ida" : "Vuelta";
    return [
      detailRow(`${tag} · Origen`, esc(leg.origin)),
      detailRow(`${tag} · Destino`, esc(leg.destination)),
      detailRow(`${tag} · Fecha`, esc(formatLegDateTime(leg.scheduledAt))),
    ];
  });
}

function approvedRows(trip: TripContactInfo): string[] {
  const rows = legRows(trip);
  if (trip.extras && trip.extras.snackChoice !== "none") {
    rows.push(
      detailRow(
        "Snacks",
        esc(SNACK_LABELS[trip.extras.snackChoice] ?? trip.extras.snackChoice),
      ),
    );
  }
  if (trip.extras?.spotifyPlaylistUrl) {
    rows.push(
      detailRow(
        "Playlist",
        `<a href="${esc(trip.extras.spotifyPlaylistUrl)}" style="color:#1E1B4B;text-decoration:underline">Spotify</a>`,
      ),
    );
  }
  rows.push(detailRow("Precio", esc(formatCents(trip.totalPriceCents))));
  if (trip.assignedCar) {
    rows.push(
      detailRow(
        "Auto",
        esc(`${trip.assignedCar.make} ${trip.assignedCar.model} · ${trip.assignedCar.plate}`),
      ),
    );
  }
  if (trip.assignedDriver) {
    rows.push(detailRow("Chofer", esc(trip.assignedDriver.name)));
  }
  return rows;
}

function rejectedRows(trip: TripContactInfo): string[] {
  const rows = legRows(trip);
  if (trip.rejectionReason) {
    rows.push(detailRow("Motivo", esc(trip.rejectionReason)));
  }
  return rows;
}

/**
 * Logo bytes for the inline (CID) attachment — email clients can't fetch
 * images from Deployment-Protected previews, so the logo travels inside
 * the email. Falls back to the public URL when the file isn't bundled
 * (e.g. missing from function tracing).
 */
let logoBase64: string | null | undefined;
function logoAttachment(): string | null {
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

function resolutionEmailHtml(
  trip: TripContactInfo,
  logoSrc: string,
): string {
  const status = EMAIL_STATUS[trip.status];
  const rows =
    trip.status === "approved" ? approvedRows(trip) : rejectedRows(trip);

  const waLink = whatsAppLinkForTrip(trip);
  const waLabel =
    trip.status === "approved" && trip.assignedDriver
      ? `Coordinar por WhatsApp con ${esc(trip.assignedDriver.name)}`
      : "Consultanos por WhatsApp";
  const waButton = waLink
    ? `<tr><td align="center" style="padding:28px 0 8px">
        <a href="${esc(waLink)}" style="display:inline-block;background:#F5C518;color:#1E1B4B;font-size:15px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:8px">${waLabel}</a>
      </td></tr>`
    : "";

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
        <tr><td align="center" style="background:#1E1B4B;padding:24px">
          <img src="${esc(logoSrc)}" alt="Carhaus" width="140" style="display:block;border:0" />
        </td></tr>
        <tr><td style="padding:32px 32px 8px">
          <p style="margin:0 0 4px;color:${status.accent};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">${status.eyebrow}</p>
          <h1 style="margin:0 0 24px;color:#1E1B4B;font-size:26px;font-weight:800">${status.title}</h1>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table>
        </td></tr>
        ${waButton}
        <tr><td style="padding:24px 32px 32px;text-align:center">
          <p style="margin:0;color:#71717a;font-size:14px">Gracias por viajar con nosotros.</p>
          <p style="margin:4px 0 0;color:#1E1B4B;font-size:14px;font-weight:700;font-style:italic">Tu viaje, a tu medida.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Throws when Resend isn't configured or the send fails — callers catch. */
async function sendResolutionEmail(
  trip: TripContactInfo,
  to: string,
): Promise<void> {
  const status = EMAIL_STATUS[trip.status];
  if (!status) throw new Error(`No email template for status "${trip.status}"`);

  const logo = logoAttachment();
  const logoSrc = logo
    ? "cid:logo"
    : `${getEnv().APP_ORIGIN}/logo-header.png`;

  await sendEmail({
    to,
    subject: status.subject,
    text: resolutionEmailText(trip),
    html: resolutionEmailHtml(trip, logoSrc),
    attachments: logo
      ? [{ filename: "logo-header.png", content: logo, contentId: "logo" }]
      : undefined,
  });
}

/**
 * Sends the email queued by `approveTrip`/`rejectTrip` and records the
 * outcome on the `notifications` row; the template follows the trip's
 * final status. Never throws — a notification failure is data (`failed`
 * + `errorMessage`), not a request error.
 */
export async function dispatchTripNotification(
  tripId: string,
): Promise<void> {
  const notification = await getPendingEmailNotification(tripId);
  if (!notification) return;

  try {
    const trip = await getTripForAdmin(tripId);
    if (!trip) throw new Error("Trip not found after resolution");
    await sendResolutionEmail(trip, notification.recipient);
    await markNotificationSent(notification.id);
  } catch (error) {
    await markNotificationFailed(
      notification.id,
      error instanceof Error ? error.message : String(error),
    ).catch(() => {
      // Last resort: if even the status update fails there is nothing to
      // retry against, so we swallow — the row stays `pending` and the
      // failure surfaces in logs.
    });
  }
}
