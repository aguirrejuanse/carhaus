/** Status header for the rider confirmation page — eyebrow, status
 *  headline (status-colored), and a per-status explainer. */

import { TRIP_STATUS_LABELS } from "@/lib/labels";
import { cn } from "cn";
import { STATUS_TEXT_STYLES } from "@/app/_components/trip-status-badge";

export function ConfirmationHeader({
  status,
  email,
}: {
  status: string;
  email: string;
}) {
  return (
    <header className="flex flex-col gap-4">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Solicitud recibida
      </p>
      <h1
        className={cn(
          "font-heading text-5xl font-bold tracking-tight",
          STATUS_TEXT_STYLES[status],
        )}
      >
        {TRIP_STATUS_LABELS[status] ?? status}
      </h1>
      <p className="max-w-md text-muted-foreground">
        {status === "pending" && (
          <>
            Estamos revisando tu viaje. Te confirmamos por email a{" "}
            <strong>{email}</strong>.
          </>
        )}
        {status === "approved" &&
          "Tu viaje está confirmado. Te contactamos por email con los detalles."}
        {status === "rejected" &&
          "No pudimos tomar este viaje. Escribinos y vemos alternativas."}
      </p>
    </header>
  );
}
