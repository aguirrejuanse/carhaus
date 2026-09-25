"use client";

/** "Tu viaje" fieldset: email, origin/destination, departure time, and
 *  the one-way / round-trip toggle. */

import { useState } from "react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toDateTimeInputValue } from "@/lib/format";
import { PlaceInput } from "./place-input";
import { SegmentedControl } from "./segmented-control";
import { TripModeToggle } from "./trip-mode-toggle";
import { ASAP_LEAD_MS } from "./use-booking-form";
import type { BookingInitial, FieldErrors } from "./types";

const DEPART_MODE_OPTIONS = [
  { value: true, label: "Ahora" },
  { value: false, label: "Programar" },
] as const;

interface Props {
  fields: FieldErrors;
  initial?: BookingInitial;
  /** Signed-in rider email — shown read-only; anonymous riders type it and
   *  verify by OTP on submit. */
  riderEmail?: string;
  roundTrip: boolean;
  onRoundTripChange: (value: boolean) => void;
  /** "Ahora" mode — no datetime input; the form sends now+ASAP_LEAD_MS. */
  departNow: boolean;
  onDepartNowChange: (value: boolean) => void;
  onLegChange: () => void;
}

export function LegFields({
  fields,
  initial,
  riderEmail,
  roundTrip,
  onRoundTripChange,
  departNow,
  onDepartNowChange,
  onLegChange,
}: Props) {
  const [departAt, setDepartAt] = useState("");
  const minNow = toDateTimeInputValue(new Date());
  // ASAP departure leaves as soon as the buffer allows — the return leg
  // can't be earlier than that.
  const minReturn = departNow
    ? toDateTimeInputValue(new Date(Date.now() + ASAP_LEAD_MS))
    : departAt || minNow;

  return (
    <FieldSet>
      <FieldLegend className="font-heading text-lg font-semibold tracking-tight">
        Tu viaje
      </FieldLegend>
      <Field data-invalid={Boolean(fields?.email)}>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={riderEmail}
          readOnly={Boolean(riderEmail)}
          placeholder="vos@ejemplo.com"
          autoComplete="email"
        />
        <FieldDescription>
          Te mandamos la confirmación del viaje acá.
        </FieldDescription>
        <FieldError>{fields?.email?.[0]}</FieldError>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={Boolean(fields?.["legs.0.origin"])}>
          <FieldLabel htmlFor="origin">Origen</FieldLabel>
          <PlaceInput
            id="origin"
            name="origin"
            placeholder="Ej. Guaymallén"
            defaultValue={initial?.origin}
            onValueCommit={onLegChange}
          />
          <FieldError>{fields?.["legs.0.origin"]?.[0]}</FieldError>
        </Field>
        <Field data-invalid={Boolean(fields?.["legs.0.destination"])}>
          <FieldLabel htmlFor="destination">Destino</FieldLabel>
          <PlaceInput
            id="destination"
            name="destination"
            placeholder="Ej. Plaza Shopping"
            defaultValue={initial?.destination}
            onValueCommit={onLegChange}
          />
          <FieldError>{fields?.["legs.0.destination"]?.[0]}</FieldError>
        </Field>
      </div>

      <Field data-invalid={Boolean(fields?.["legs.0.scheduledAt"])}>
        <div className="flex items-center justify-between gap-3">
          <FieldLabel htmlFor="departAt">Salida</FieldLabel>
          <SegmentedControl
            options={DEPART_MODE_OPTIONS}
            value={departNow}
            onChange={onDepartNowChange}
          />
        </div>
        {/* hidden, not unmounted — keeps the label association and the
            value if the rider flips back to "Programar". Not required
            while hidden, or browser validation would block the submit
            on a control the user can't see. */}
        <Input
          id="departAt"
          name="departAt"
          type="datetime-local"
          required={!departNow}
          hidden={departNow}
          min={minNow}
          onChange={(event) => {
            setDepartAt(event.target.value);
            onLegChange();
          }}
        />
        {departNow && (
          <FieldDescription>
            Salida lo antes posible — te confirmamos la hora exacta por
            email.
          </FieldDescription>
        )}
        <FieldError>{fields?.["legs.0.scheduledAt"]?.[0]}</FieldError>
      </Field>

      <Field orientation="horizontal">
        <TripModeToggle roundTrip={roundTrip} onChange={onRoundTripChange} />
      </Field>

      {roundTrip && (
        <Field
          data-invalid={Boolean(fields?.["legs.1.scheduledAt"])}
          className="animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <FieldLabel htmlFor="returnAt">Fecha y hora de vuelta</FieldLabel>
          <Input
            id="returnAt"
            name="returnAt"
            type="datetime-local"
            required={roundTrip}
            min={minReturn}
            onChange={onLegChange}
          />
          <FieldDescription>
            La vuelta es por el mismo recorrido, al revés.
          </FieldDescription>
          <FieldError>{fields?.["legs.1.scheduledAt"]?.[0]}</FieldError>
        </Field>
      )}
    </FieldSet>
  );
}
