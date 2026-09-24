/**
 * Admin trip detail — review + approve/reject (spec: "Approve with
 * Assignment", "Reject Trip"). Server Component loads the trip, fleet and
 * drivers; `TripActions` (client) owns the PATCH interaction with
 * `useTransition` + `router.refresh()` (design "Client Convention").
 */

import { notFound } from "next/navigation";
import { getActiveCars, getDrivers, getTripForAdmin } from "@/db/queries";
import { TripActions } from "./trip-actions";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

const priceFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
};

const SNACK_LABELS: Record<string, string> = {
  none: "Sin snack",
  sweet: "Dulce",
  salty: "Salado",
  mixed: "Mixto",
};

export default async function AdminTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [trip, cars, drivers] = await Promise.all([
    getTripForAdmin(id),
    getActiveCars(),
    getDrivers(),
  ]);
  if (!trip) notFound();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {STATUS_LABELS[trip.status] ?? trip.status}
        </p>
        <h1 className="font-heading text-4xl font-bold tracking-tight">
          {trip.user.email}
        </h1>
      </header>

      <section className="flex flex-col gap-4">
        {trip.legs.map((leg) => (
          <div
            key={leg.id}
            className="flex flex-col gap-1 rounded-lg border border-border p-4"
          >
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {leg.sequence === 1 ? "Ida" : "Vuelta"}
            </p>
            <p className="font-medium">
              {leg.origin} → {leg.destination}
            </p>
            <p className="text-sm text-muted-foreground">
              {dateFormatter.format(leg.scheduledAt)}
            </p>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">
            {trip.totalPriceCents > 0
              ? priceFormatter.format(trip.totalPriceCents / 100)
              : "Sin precio (revisar manualmente)"}
          </span>
          {trip.extras && (
            <>
              <span className="rounded-md bg-accent px-2 py-1 text-accent-foreground">
                {SNACK_LABELS[trip.extras.snackChoice] ??
                  trip.extras.snackChoice}
              </span>
              {trip.extras.acTemperatureCelsius != null && (
                <span className="rounded-md bg-accent px-2 py-1 text-accent-foreground">
                  Aire {trip.extras.acTemperatureCelsius}°C
                </span>
              )}
              {trip.extras.spotifyPlaylistUrl && (
                <a
                  href={trip.extras.spotifyPlaylistUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-accent px-2 py-1 text-accent-foreground underline"
                >
                  Playlist
                </a>
              )}
            </>
          )}
        </div>

        {trip.status === "approved" && (
          <p className="text-sm text-muted-foreground">
            Asignado: {trip.assignedCar?.make} {trip.assignedCar?.model} (
            {trip.assignedCar?.plate}) · {trip.assignedDriver?.name}
          </p>
        )}
        {trip.status === "rejected" && trip.rejectionReason && (
          <p className="text-sm text-muted-foreground">
            Motivo: {trip.rejectionReason}
          </p>
        )}
      </section>

      {trip.status === "pending" && (
        <TripActions tripId={trip.id} cars={cars} drivers={drivers} />
      )}
    </main>
  );
}
