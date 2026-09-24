/**
 * Rider confirmation page (design decision #8: unguessable public link —
 * `trips.publicToken`, no auth required). Read-only: approved trips are
 * immutable per spec "Trip Immutability", and there is no edit surface for
 * pending ones either.
 */

import { notFound } from "next/navigation";
import { getTripByPublicToken } from "@/db/queries";
import { whatsAppLinkForTrip } from "@/lib/notifications";
import { SaveTemplateButton } from "./save-template";

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

const STATUS_LABELS: Record<string, string> = {
  pending: "En revisión",
  approved: "Confirmado",
  rejected: "No disponible",
};

const SNACK_LABELS: Record<string, string> = {
  none: "Sin snack",
  sweet: "Dulce",
  salty: "Salado",
  mixed: "Mixto",
};

export default async function TripConfirmationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const trip = await getTripByPublicToken(token);
  if (!trip) notFound();

  // Spec "WhatsApp Deep Link": surfaced to the rider once the trip is
  // approved — driver phone, else the operator fallback.
  const waLink =
    trip.status === "approved" ? whatsAppLinkForTrip(trip) : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-10 px-6 py-16 sm:py-24">
      <header className="flex flex-col gap-4">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Solicitud recibida
        </p>
        <h1 className="font-heading text-5xl font-bold tracking-tight">
          {STATUS_LABELS[trip.status] ?? trip.status}
        </h1>
        <p className="max-w-md text-muted-foreground">
          {trip.status === "pending" &&
            "Estamos revisando tu viaje. Te confirmamos por email a "}
          {trip.status === "pending" && <strong>{trip.user.email}</strong>}
          {trip.status === "pending" && "."}
          {trip.status === "approved" &&
            "Tu viaje está confirmado. Te contactamos por email con los detalles."}
          {trip.status === "rejected" &&
            "No pudimos tomar este viaje. Escribinos y vemos alternativas."}
        </p>
      </header>

      <hr className="border-border" />

      <section className="flex flex-col gap-4">
        {trip.legs.map((leg) => (
          <div
            key={leg.id}
            className="flex flex-col gap-1 rounded-lg border border-border p-4"
          >
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {leg.sequence === 1 ? "Ida" : "Vuelta"} ·{" "}
              {dateFormatter.format(leg.scheduledAt)}
            </p>
            <p className="font-medium">
              {leg.origin} → {leg.destination}
            </p>
          </div>
        ))}

        {trip.totalPriceCents > 0 && (
          <p className="text-sm text-muted-foreground">
            Precio estimado:{" "}
            <span className="font-medium text-foreground">
              {priceFormatter.format(trip.totalPriceCents / 100)}
            </span>
          </p>
        )}

        {trip.extras && (
          <ul className="flex flex-wrap gap-2 text-sm">
            <li className="rounded-md bg-accent px-2 py-1 text-accent-foreground">
              {SNACK_LABELS[trip.extras.snackChoice] ?? trip.extras.snackChoice}
            </li>
            {trip.extras.acTemperatureCelsius != null && (
              <li className="rounded-md bg-accent px-2 py-1 text-accent-foreground">
                Aire {trip.extras.acTemperatureCelsius}°C
              </li>
            )}
            {trip.extras.spotifyPlaylistUrl && (
              <li className="rounded-md bg-accent px-2 py-1 text-accent-foreground">
                Playlist propia
              </li>
            )}
          </ul>
        )}

        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Coordinar por WhatsApp{trip.assignedDriver && ` con ${trip.assignedDriver.name}`}
          </a>
        )}

        <SaveTemplateButton
          legs={trip.legs.map((leg) => ({
            origin: leg.origin,
            destination: leg.destination,
          }))}
          extras={{
            snackChoice: trip.extras?.snackChoice ?? "none",
            spotifyPlaylistUrl: trip.extras?.spotifyPlaylistUrl ?? undefined,
            acTemperatureCelsius:
              trip.extras?.acTemperatureCelsius ?? undefined,
          }}
          defaultName={`${trip.legs[0].origin} → ${trip.legs[0].destination}`}
        />
      </section>
    </main>
  );
}
