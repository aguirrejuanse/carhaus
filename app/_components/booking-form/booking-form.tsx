"use client";

/**
 * Rider booking form (spec: "Rider Trip Request", "Price Preview", "Trip
 * Extras"). Mutations go through Route Handlers via `apiFetch` — no Server
 * Actions (design decision #2). `useActionState` still works because React
 * 19 accepts any async function as a form action (design "Client
 * Convention").
 *
 * Composition shell — state lives in `useBookingForm`, sections in
 * sibling subcomponents.
 */

import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { VerifyEmailForm } from "../verify-email-form";
import { ExtrasFields } from "./extras-fields";
import { LegFields } from "./leg-fields";
import { PreviewPanel } from "./preview-panel";
import { useBookingForm } from "./use-booking-form";
import type { BookingInitial } from "./types";

interface Props {
  initial?: BookingInitial;
  /** Signed-in rider — locks the email field and skips verification. */
  riderEmail?: string;
}

export function BookingForm({ initial, riderEmail }: Props) {
  const form = useBookingForm(initial);
  const verifying = form.needsVerification && Boolean(form.verificationEmail);

  return (
    <div className="w-full">
      {verifying && (
        <div className="mb-8 flex flex-col gap-4 rounded-lg border border-border p-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              Confirmá tu email
            </h2>
            <p className="text-sm text-muted-foreground">
              Te mandamos un código para verificar que el email es tuyo. Tu
              solicitud se envía en cuanto lo ingreses.
            </p>
          </div>
          <VerifyEmailForm
            email={form.verificationEmail}
            onVerified={form.retryBooking}
          />
        </div>
      )}

      {/* hidden, not unmounted — if the post-verify retry fails (e.g. a
          stale quote), the rider's inputs must survive. */}
      <form
        ref={form.formRef}
        onSubmit={form.onSubmit}
        hidden={verifying}
        className="w-full"
      >
        <FieldGroup>
        <div data-tour="trip">
          <LegFields
            fields={form.fields}
            initial={initial}
            riderEmail={riderEmail}
            roundTrip={form.roundTrip}
            onRoundTripChange={form.setRoundTrip}
            departNow={form.departNow}
            onDepartNowChange={form.setDepartNow}
            onLegChange={form.bumpLegs}
          />
        </div>
        <div data-tour="extras">
          <ExtrasFields
            fields={form.fields}
            initial={initial}
            snackChoice={form.snackChoice}
            onSnackChange={form.setSnackChoice}
          />
        </div>
        {/* data-tour only when the panel has content — highlighting an
            empty box reads as a broken step; without it the tour popover
            centers instead. */}
        <div data-tour={form.preview ? "preview" : undefined}>
          <PreviewPanel preview={form.preview} status={form.previewStatus} />
        </div>

        {form.error && (
          <p role="alert" className="text-sm text-destructive">
            {form.error}
          </p>
        )}

        <div data-tour="submit" className="w-fit">
          <Button
            type="submit"
            disabled={form.isPending}
            className="w-full sm:w-auto"
          >
            {form.isPending ? "Enviando…" : "Pedir viaje"}
          </Button>
        </div>
        </FieldGroup>
      </form>
    </div>
  );
}
