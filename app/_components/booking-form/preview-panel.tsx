/** Price preview panel — loading / provider-down fallback / priced quote. */

import { formatCents } from "@/lib/format";
import type { PricePreview } from "@/lib/services/booking";
import type { PreviewStatus } from "./types";

export function PreviewPanel({
  preview,
  status,
}: {
  preview: PricePreview | null;
  status: PreviewStatus;
}) {
  if (status === "loading") {
    return (
      <p className="animate-in fade-in text-sm text-muted-foreground duration-300">
        Calculando precio estimado…
      </p>
    );
  }

  if (status === "error") {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 rounded-lg border border-border p-4 text-sm duration-300">
        <p className="font-medium">No pudimos calcular el precio ahora.</p>
        <p className="text-muted-foreground">
          Podés enviar la solicitud igual y te confirmamos el valor por mail.
        </p>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 rounded-lg border border-border p-4 duration-300">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Precio estimado
      </p>
      <p className="mt-1 font-heading text-3xl font-bold tracking-tight">
        {formatCents(preview.quote.totalPriceCents)}
      </p>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {preview.quote.legs.map((leg, index) => (
          <li key={leg.sequence}>
            {leg.sequence === 1 ? "Ida" : "Vuelta"}:{" "}
            {formatCents(leg.priceCents)}
            {preview.resolved[index] && (
              <span className="block text-xs">
                {preview.resolved[index].origin} →{" "}
                {preview.resolved[index].destination}
              </span>
            )}
          </li>
        ))}
      </ul>
      {/* eslint-disable-next-line @next/next/no-img-element -- proxied static map, not a Next-optimizable asset */}
      <img
        src={preview.mapUrl}
        alt="Mapa del recorrido"
        className="mt-3 w-full rounded-md border border-border"
        loading="lazy"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
    </div>
  );
}
