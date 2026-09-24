/** Presentational trip list — one bordered row per trip, newest first.
 *  Shared by `RiderTrips` (confirmation page section) and `/viajes`. */

import Link from "next/link";
import { formatCents, formatLegDateTime } from "@/lib/format";
import { TRIP_STATUS_LABELS } from "@/lib/labels";
import type { getTripsByUserId } from "@/db/queries";

interface Props {
  trips: Awaited<ReturnType<typeof getTripsByUserId>>;
}

export function TripList({ trips }: Props) {
  return (
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
  );
}
