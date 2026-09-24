/** Read-only trip summary: leg cards, estimated price, extras chips. */

import { formatCents, formatLegDateTime } from "@/lib/format";
import { SNACK_LABELS } from "@/lib/labels";

interface TripSummaryProps {
  legs: Array<{
    id: string;
    sequence: number;
    origin: string;
    destination: string;
    scheduledAt: Date;
  }>;
  totalPriceCents: number;
  extras: {
    snackChoice: string;
    acTemperatureCelsius: number | null;
    spotifyPlaylistUrl: string | null;
  } | null;
}

export function TripSummary({
  legs,
  totalPriceCents,
  extras,
}: TripSummaryProps) {
  return (
    <section className="flex flex-col gap-4">
      {legs.map((leg) => (
        <div
          key={leg.id}
          className="flex flex-col gap-1 rounded-lg border border-border p-4"
        >
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {leg.sequence === 1 ? "Ida" : "Vuelta"} ·{" "}
            {formatLegDateTime(leg.scheduledAt)}
          </p>
          <p className="font-medium">
            {leg.origin} → {leg.destination}
          </p>
        </div>
      ))}

      {totalPriceCents > 0 && (
        <p className="text-sm text-muted-foreground">
          Precio estimado:{" "}
          <span className="font-medium text-foreground">
            {formatCents(totalPriceCents)}
          </span>
        </p>
      )}

      {extras && (
        <ul className="flex flex-wrap gap-2 text-sm">
          <li className="rounded-md bg-accent px-2 py-1 text-accent-foreground">
            {SNACK_LABELS[extras.snackChoice] ?? extras.snackChoice}
          </li>
          {extras.acTemperatureCelsius != null && (
            <li className="rounded-md bg-accent px-2 py-1 text-accent-foreground">
              Aire {extras.acTemperatureCelsius}°C
            </li>
          )}
          {extras.spotifyPlaylistUrl && (
            <li className="rounded-md bg-accent px-2 py-1 text-accent-foreground">
              Playlist propia
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
