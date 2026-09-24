/**
 * Admin review queue (spec: "Admin Review Queue"). Server Component —
 * middleware already redirects unauthenticated requests to /admin/login,
 * and `/api/admin/*` re-verifies independently, so this page can trust it
 * only renders for admins. Tabs filter by trip status via `?status=`.
 */

import Link from "next/link";
import { getTripCountsByStatus, getTripsByStatus } from "@/db/queries";
import { TRIP_STATUS, type TripStatus } from "@/db/schema";
import { formatCents, formatLegDateTime } from "@/lib/format";
import { cn } from "cn";

export const dynamic = "force-dynamic";

const STATUS_TABS: Array<{ status: TripStatus; label: string }> = [
  { status: TRIP_STATUS.PENDING, label: "Pendientes" },
  { status: TRIP_STATUS.APPROVED, label: "Aprobados" },
  { status: TRIP_STATUS.REJECTED, label: "Rechazados" },
];

const EMPTY_COPY: Record<TripStatus, string> = {
  [TRIP_STATUS.PENDING]: "No hay viajes pendientes de revisión.",
  [TRIP_STATUS.APPROVED]: "Todavía no hay viajes aprobados.",
  [TRIP_STATUS.REJECTED]: "Todavía no hay viajes rechazados.",
};

function parseStatus(value: string | undefined): TripStatus {
  return STATUS_TABS.some((t) => t.status === value)
    ? (value as TripStatus)
    : TRIP_STATUS.PENDING;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: raw } = await searchParams;
  const status = parseStatus(raw);
  const [counts, trips] = await Promise.all([
    getTripCountsByStatus(),
    getTripsByStatus(status),
  ]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-4">
        <h1 className="font-heading text-5xl font-bold tracking-tight">
          Viajes
        </h1>
        <nav className="flex gap-2">
          {STATUS_TABS.map((tab) => (
            <Link
              key={tab.status}
              href={`/admin?status=${tab.status}`}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-200",
                tab.status === status
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {tab.label}
              {counts[tab.status] != null && (
                <span className="ml-1.5 opacity-70">
                  {counts[tab.status]}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </header>

      {trips.length === 0 ? (
        <p className="text-muted-foreground">{EMPTY_COPY[status]}</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {trips.map((trip) => (
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
                    {formatLegDateTime(trip.legs[0].scheduledAt)}
                    {trip.legs.length === 2 && " · ida y vuelta"}
                  </p>
                </div>
                <p className="font-heading text-lg font-semibold">
                  {trip.totalPriceCents > 0
                    ? formatCents(trip.totalPriceCents)
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
