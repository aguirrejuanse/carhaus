import type { getTripForAdmin } from "@/db/queries";
import { whatsAppLinkForTrip } from "@/lib/notifications";

type Trip = NonNullable<Awaited<ReturnType<typeof getTripForAdmin>>>;

/** Resolved-state readout for the admin detail — assignment + WhatsApp
 *  link for approved trips, rejection reason for rejected ones. Nothing
 *  while pending (the actions panel renders instead). */
export function StatusNote({ trip }: { trip: Trip }) {
  if (trip.status === "approved") {
    const waLink = whatsAppLinkForTrip(trip);
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Asignado: {trip.assignedCar?.make} {trip.assignedCar?.model} (
          {trip.assignedCar?.plate}) · {trip.assignedDriver?.name}
        </p>
        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            WhatsApp {trip.assignedDriver?.name ?? "operador"}
          </a>
        )}
      </div>
    );
  }
  if (trip.status === "rejected" && trip.rejectionReason) {
    return (
      <p className="text-sm text-muted-foreground">
        Motivo: {trip.rejectionReason}
      </p>
    );
  }
  return null;
}
