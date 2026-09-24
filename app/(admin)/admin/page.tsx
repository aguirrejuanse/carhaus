/**
 * Admin review queue (spec: "Admin Review Queue"). Server Component —
 * middleware already redirects unauthenticated requests to /admin/login,
 * and `/api/admin/*` re-verifies independently, so this page can trust it
 * only renders for admins.
 */

import Link from "next/link";
import { getPendingTrips } from "@/db/queries";

export const dynamic = "force-dynamic";

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

export default async function AdminPage() {
  const pending = await getPendingTrips();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Carhaus · Admin
        </p>
        <h1 className="font-heading text-5xl font-bold tracking-tight">
          Viajes pendientes
        </h1>
      </header>

      {pending.length === 0 ? (
        <p className="text-muted-foreground">
          No hay viajes pendientes de revisión.
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {pending.map((trip) => (
            <li key={trip.id}>
              <Link
                href={`/admin/trips/${trip.id}`}
                className="flex items-center justify-between gap-4 py-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex flex-col gap-1">
                  <p className="font-medium">{trip.user.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {trip.legs
                      .map((leg) => `${leg.origin} → ${leg.destination}`)
                      .join(" · ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dateFormatter.format(trip.legs[0].scheduledAt)}
                    {trip.legs.length === 2 && " · ida y vuelta"}
                  </p>
                </div>
                <p className="font-heading text-lg font-semibold">
                  {trip.totalPriceCents > 0
                    ? priceFormatter.format(trip.totalPriceCents / 100)
                    : "Sin precio"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
