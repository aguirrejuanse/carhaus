/** Colored status chip — brand navy for pending ("with us", not a
 *  warning), emerald for approved, red for rejected. Shared by rider
 *  views (`/viajes`, confirmation) and admin detail so the status reads
 *  the same everywhere. */

import { TRIP_STATUS_LABELS } from "@/lib/labels";
import { cn } from "cn";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-primary/10 text-primary",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

/** Text-only variant for large headlines (confirmation page h1). */
export const STATUS_TEXT_STYLES: Record<string, string> = {
  pending: "text-primary",
  approved: "text-emerald-700",
  rejected: "text-red-700",
};

export function TripStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-md px-2 py-0.5 text-xs font-medium",
        STATUS_STYLES[status] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {TRIP_STATUS_LABELS[status] ?? status}
    </span>
  );
}
