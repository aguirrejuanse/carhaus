/** Price preview panel — loading / provider-down fallback / priced quote. */

import { formatCents } from "@/lib/format";
import type { Preview, PreviewStatus } from "./types";

export function PreviewPanel({
  preview,
  status,
}: {
  preview: Preview | null;
  status: PreviewStatus;
}) {
  if (status === "loading") {
    return (
      <p className="text-sm text-muted-foreground">
        Calculando precio estimado…
      </p>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-lg border border-border p-4 text-sm">
        <p className="font-medium">No pudimos calcular el precio ahora.</p>
        <p className="text-muted-foreground">
          Podés enviar la solicitud igual y te confirmamos el valor por mail.
        </p>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Precio estimado
      </p>
      <p className="mt-1 font-heading text-3xl font-bold tracking-tight">
        {formatCents(preview.quote.totalPriceCents)}
      </p>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {preview.quote.legs.map((leg) => (
          <li key={leg.sequence}>
            {leg.sequence === 1 ? "Ida" : "Vuelta"}:{" "}
            {formatCents(leg.priceCents)}
          </li>
        ))}
      </ul>
    </div>
  );
}
