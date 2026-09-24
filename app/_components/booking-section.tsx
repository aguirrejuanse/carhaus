"use client";

/**
 * Booking section: saved-template picker + booking form (spec:
 * "Session-Scoped Template Listing", "Re-request Template"). Selecting a
 * template pre-fills the form — dates stay empty so a re-request always
 * re-runs the price preview and confirmation. The form remounts on
 * selection (`key`) so the pre-filled values apply cleanly.
 */

import { useState } from "react";
import { useTemplatesQuery } from "@/app/_hooks/use-templates-query";
import type { TemplateItem } from "@/lib/services/templates";
import { BookingForm, type BookingInitial } from "./booking-form";

export function BookingSection({
  initialTemplates,
  riderEmail,
}: {
  initialTemplates: TemplateItem[];
  riderEmail?: string;
}) {
  // Server-fetched templates seed the query cache; a save from the
  // confirmation page invalidates this and the list refreshes on its own.
  const { data: templates = [] } = useTemplatesQuery(initialTemplates);
  const [initial, setInitial] = useState<BookingInitial | undefined>();
  const [formKey, setFormKey] = useState(0);

  const applyTemplate = (template: TemplateItem) => {
    setInitial({
      origin: template.legs[0]?.origin ?? "",
      destination: template.legs[0]?.destination ?? "",
      roundTrip: template.legs.length === 2,
      snackChoice: template.snackChoice,
      spotifyPlaylistUrl: template.spotifyPlaylistUrl ?? undefined,
      acTemperatureCelsius: template.acTemperatureCelsius ?? undefined,
    });
    setFormKey((k) => k + 1);
  };

  return (
    <div className="flex w-full flex-col gap-10">
      {templates.length > 0 && (
        <section className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Tus plantillas
          </p>
          <ul className="divide-y divide-border border-y border-border">
            {templates.map((template) => (
              <li
                key={template.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="flex flex-col">
                  <p className="font-medium">{template.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {template.legs
                      .map((leg) => `${leg.origin} → ${leg.destination}`)
                      .join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-colors hover:opacity-90"
                >
                  Repetir
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <BookingForm key={formKey} initial={initial} riderEmail={riderEmail} />
    </div>
  );
}
