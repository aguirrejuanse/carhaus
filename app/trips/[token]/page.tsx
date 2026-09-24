/**
 * Rider confirmation page (design decision #8: unguessable public link —
 * `trips.publicToken`, no auth required). Read-only: approved trips are
 * immutable per spec "Trip Immutability", and there is no edit surface for
 * pending ones either.
 */

import { notFound } from "next/navigation";
import { getTripByPublicToken } from "@/db/queries";
import { whatsAppLinkForTrip } from "@/lib/notifications";
import { ConfirmationHeader } from "./confirmation-header";
import { SaveTemplateButton } from "./save-template";
import { TripSummary } from "./trip-summary";

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
      <ConfirmationHeader status={trip.status} email={trip.user.email} />
      <hr className="border-border" />
      <TripSummary
        legs={trip.legs}
        totalPriceCents={trip.totalPriceCents}
        extras={trip.extras}
      />
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
    </main>
  );
}
