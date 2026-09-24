/**
 * "Tus viajes" — the rider's recent trips on the confirmation page, so a
 * returning rider can jump back to any request. Server component: reads
 * the `carhaus_rider` cookie, renders nothing when anonymous or empty.
 */

import { cookies } from "next/headers";
import Link from "next/link";
import { getTripsByUserId } from "@/db/queries";
import { formatCents, formatLegDateTime } from "@/lib/format";
import { TRIP_STATUS_LABELS } from "@/lib/labels";
import { RIDER_COOKIE_NAME, riderFromCookieValue } from "@/lib/rider";

export async function RiderTrips() {
  const store = await cookies();
  const rider = await riderFromCookieValue(
    store.get(RIDER_COOKIE_NAME)?.value,
  );
  if (!rider) return null;

  const trips = await getTripsByUserId(rider.userId);
  if (trips.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-lg font-semibold tracking-tight">
        Tus viajes
      </h2>
      <ul className="flex flex-col gap-2">
        {trips.map((trip) => (
          <li key={trip.publicToken}>
            <Link
              href={`/trips/${trip.publicToken}`}
              className="flex items-center justify-between gap-4 rounded-lg border border-border p-3 text-sm transition-colors duration-200 hover:border-foreground/30"
            >
              <span className="font-medium">
                {trip.origin} → {trip.destination}
              </span>
              <span className="text-right text-xs text-muted-foreground">
                {formatLegDateTime(trip.createdAt)} ·{" "}
                {TRIP_STATUS_LABELS[trip.status] ?? trip.status}
                {trip.totalPriceCents > 0 &&
                  ` · ${formatCents(trip.totalPriceCents)}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
