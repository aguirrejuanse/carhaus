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

import { Resend } from "resend";
import {
  getPendingEmailNotification,
  getTripForAdmin,
  markNotificationFailed,
  markNotificationSent,
} from "@/db/queries";
import { getEnv } from "./env";

/** Minimal trip shape the notification copy needs — keeps callers loose. */
interface TripContactInfo {
  legs: Array<{
    sequence: number;
    origin: string;
    destination: string;
    scheduledAt: Date;
  }>;
  totalPriceCents: number;
  assignedDriver?: { name: string; phone: string } | null;
  assignedCar?: { make: string; model: string; plate: string } | null;
}

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

const priceFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

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
  return `Hola! Consulta por el viaje Carhaus: ${firstLeg.origin} → ${firstLeg.destination}, ${dateFormatter.format(firstLeg.scheduledAt)}.`;
}

/**
 * wa.me link for a trip: assigned driver's phone first, falling back to
 * `OPERATOR_WHATSAPP_NUMBER` (design decision #6). `null` when neither
 * exists — callers just don't render the link.
 */
export function whatsAppLinkForTrip(trip: TripContactInfo): string | null {
  const phone =
    trip.assignedDriver?.phone ?? getEnv().OPERATOR_WHATSAPP_NUMBER;
  if (!phone) return null;
  return buildWhatsAppLink(phone, tripWhatsAppMessage(trip));
}

function approvalEmailText(trip: TripContactInfo): string {
  const legs = trip.legs
    .map(
      (leg) =>
        `${leg.sequence === 1 ? "Ida" : "Vuelta"}: ${leg.origin} → ${leg.destination} — ${dateFormatter.format(leg.scheduledAt)}`,
    )
    .join("\n");
  const assignment =
    trip.assignedCar && trip.assignedDriver
      ? `Auto: ${trip.assignedCar.make} ${trip.assignedCar.model} (${trip.assignedCar.plate}) · Chofer: ${trip.assignedDriver.name}`
      : "";
  return `Tu viaje Carhaus fue confirmado.\n\n${legs}\n\nPrecio: ${priceFormatter.format(trip.totalPriceCents / 100)}\n${assignment}`;
}

/** Throws when Resend isn't configured or the send fails — callers catch. */
async function sendApprovalEmail(
  trip: TripContactInfo,
  to: string,
): Promise<void> {
  const env = getEnv();
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.RESEND_FROM ?? "Carhaus <onboarding@resend.dev>",
    to,
    subject: "Tu viaje Carhaus fue confirmado",
    text: approvalEmailText(trip),
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Sends the approval email queued by `approveTrip` and records the
 * outcome on the `notifications` row. Never throws — a notification
 * failure is data (`failed` + `errorMessage`), not a request error.
 */
export async function dispatchApprovalNotification(
  tripId: string,
): Promise<void> {
  const notification = await getPendingEmailNotification(tripId);
  if (!notification) return;

  try {
    const trip = await getTripForAdmin(tripId);
    if (!trip) throw new Error("Trip not found after approval");
    await sendApprovalEmail(trip, notification.recipient);
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
