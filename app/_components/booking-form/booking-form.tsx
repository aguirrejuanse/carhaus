"use client";

/**
 * Rider booking form (spec: "Rider Trip Request", "Price Preview", "Trip
 * Extras"). Mutations go through Route Handlers via TanStack `useMutation`
 * over `apiFetch` — no Server Actions (design decision #2).
 *
 * Composition shell — state lives in `useBookingForm`, sections in
 * sibling subcomponents.
 */

import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { ExtrasFields } from "./extras-fields";
import { LegFields } from "./leg-fields";
import { PreviewPanel } from "./preview-panel";
import type { BookingInitial } from "./types";
import { useBookingForm } from "./use-booking-form";

export function BookingForm({ initial }: { initial?: BookingInitial }) {
  const form = useBookingForm(initial);

  return (
    <form ref={form.formRef} onSubmit={form.onSubmit} className="w-full">
      <FieldGroup>
        <LegFields
          fields={form.fields}
          roundTrip={form.roundTrip}
          initial={initial}
          onRoundTripChange={form.setRoundTrip}
          onLegChange={form.bumpLegs}
        />
        <ExtrasFields
          fields={form.fields}
          snackChoice={form.snackChoice}
          initial={initial}
          onSnackChange={form.setSnackChoice}
        />
        <PreviewPanel preview={form.preview} status={form.previewStatus} />

        {form.error && (
          <p role="alert" className="text-sm text-destructive">
            {form.error}
          </p>
        )}

        <Button
          type="submit"
          disabled={form.isPending}
          className="w-full sm:w-auto"
        >
          {form.isPending ? "Enviando…" : "Pedir viaje"}
        </Button>
      </FieldGroup>
    </form>
  );
}
