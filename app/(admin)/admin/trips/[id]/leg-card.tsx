import { formatLegDateLong } from "@/lib/format";
import type { tripLegs } from "@/db/schema";

type Leg = typeof tripLegs.$inferSelect;

export function LegCard({ leg }: { leg: Leg }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-4">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {leg.sequence === 1 ? "Ida" : "Vuelta"}
      </p>
      <p className="font-medium">
        {leg.origin} → {leg.destination}
      </p>
      <p className="text-sm text-muted-foreground">
        {formatLegDateLong(leg.scheduledAt)}
      </p>
    </div>
  );
}
