import type { getTripForAdmin } from "@/db/queries";

type Trip = NonNullable<Awaited<ReturnType<typeof getTripForAdmin>>>;

/** Resolved-state readout for the admin detail — assignment for approved
 *  trips, rejection reason for rejected ones. Nothing while pending (the
 *  actions panel renders instead). */
export function StatusNote({ trip }: { trip: Trip }) {
  if (trip.status === "approved") {
    return (
      <p className="text-sm text-muted-foreground">
        Asignado: {trip.assignedCar?.make} {trip.assignedCar?.model} (
        {trip.assignedCar?.plate}) · {trip.assignedDriver?.name}
      </p>
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
