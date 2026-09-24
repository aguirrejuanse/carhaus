"use client";

/**
 * Booking section: saved-template picker + booking form (spec:
 * "Session-Scoped Template Listing", "Re-request Template"). Selecting a
 * template pre-fills the form — dates stay empty so a re-request always
 * re-runs the price preview and confirmation. The form remounts on
 * selection (`key`) so the pre-filled values apply cleanly.
 */

import { useState } from "react";
import type { TemplateLeg } from "@/db/schema";
import { BookingForm, type BookingInitial } from "./booking-form";

export interface TemplateItem {
  id: string;
  name: string;
  legs: TemplateLeg[];
  snackChoice: string;
  spotifyPlaylistUrl: string | null;
  acTemperatureCelsius: number | null;
}

export function BookingSection({ templates }: { templates: TemplateItem[] }) {
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

      <BookingForm key={formKey} initial={initial} />
    </div>
  );
}
