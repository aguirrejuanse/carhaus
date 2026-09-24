/**
 * Admin trip detail — review + approve/reject (spec: "Approve with
 * Assignment", "Reject Trip"). Server Component loads the trip, fleet and
 * drivers; `TripActions` (client) owns the PATCH interaction via
 * `useAdminTripMutation` + `router.refresh()` (design "Client Convention").
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getActiveCars, getDrivers, getTripForAdmin } from "@/db/queries";
import { formatCents } from "@/lib/format";
import { TripStatusBadge } from "@/app/_components/trip-status-badge";
import { ExtrasChips } from "./extras-chips";
import { LegCard } from "./leg-card";
import { StatusNote } from "./status-note";
import { TripActions } from "./trip-actions";

export const dynamic = "force-dynamic";

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
        <Link
          href="/admin"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Viajes
        </Link>
        <TripStatusBadge status={trip.status} />
        <h1 className="font-heading text-4xl font-bold tracking-tight">
          {trip.user.email}
        </h1>
      </header>

      <section className="flex flex-col gap-4">
        {trip.legs.map((leg) => (
          <LegCard key={leg.id} leg={leg} />
        ))}

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">
            {trip.totalPriceCents > 0
              ? formatCents(trip.totalPriceCents)
              : "Sin precio (revisar manualmente)"}
          </span>
          <ExtrasChips extras={trip.extras} />
        </div>

        <StatusNote trip={trip} />
      </section>

      {trip.status === "pending" && (
        <TripActions tripId={trip.id} cars={cars} drivers={drivers} />
      )}
    </main>
  );
}
