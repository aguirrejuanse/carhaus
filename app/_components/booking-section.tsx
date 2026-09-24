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
import { TemplateList } from "./template-list";

export function BookingSection({
  initialTemplates,
}: {
  initialTemplates: TemplateItem[];
}) {
  // Server-fetched templates seed the query cache; a save from the
  // confirmation page invalidates this and the list refreshes on its own.
  const { data: templates = [], isPending } =
    useTemplatesQuery(initialTemplates);
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
      <TemplateList
        templates={templates}
        isLoading={isPending}
        onApply={applyTemplate}
      />
      {/* Keyed wrapper remounts on template apply — the fade keeps the
          swap from feeling like a hard cut. */}
      <div key={formKey} className="animate-in fade-in duration-300">
        <BookingForm initial={initial} />
      </div>
    </div>
  );
}
