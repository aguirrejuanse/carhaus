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
import { TripModeToggle } from "./trip-mode-toggle";
import type { BookingInitial, FieldErrors } from "./types";

interface Props {
  fields: FieldErrors;
  initial?: BookingInitial;
  roundTrip: boolean;
  onRoundTripChange: (value: boolean) => void;
  onLegChange: () => void;
}

export function LegFields({
  fields,
  initial,
  roundTrip,
  onRoundTripChange,
  onLegChange,
}: Props) {
  const [departAt, setDepartAt] = useState("");
  const minNow = toDateTimeInputValue(new Date());

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
        <FieldLabel htmlFor="departAt">Fecha y hora de ida</FieldLabel>
        <Input
          id="departAt"
          name="departAt"
          type="datetime-local"
          required
          min={minNow}
          onChange={(event) => {
            setDepartAt(event.target.value);
            onLegChange();
          }}
        />
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
            min={departAt || minNow}
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
