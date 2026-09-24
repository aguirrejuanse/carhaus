"use client";

/** "Tu viaje" fieldset: email, origin/destination, departure time, and
 *  the one-way / round-trip toggle. */

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { FieldErrors } from "./types";

const TRIP_MODE_OPTIONS = [
  { value: false, label: "Solo ida" },
  { value: true, label: "Ida y vuelta" },
] as const;

interface Props {
  fields: FieldErrors;
  roundTrip: boolean;
  onRoundTripChange: (value: boolean) => void;
  onLegChange: () => void;
}

export function LegFields({
  fields,
  roundTrip,
  onRoundTripChange,
  onLegChange,
}: Props) {
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
          <Input
            id="origin"
            name="origin"
            required
            placeholder="Ej. Guaymallén"
            onChange={onLegChange}
          />
          <FieldError>{fields?.["legs.0.origin"]?.[0]}</FieldError>
        </Field>
        <Field data-invalid={Boolean(fields?.["legs.0.destination"])}>
          <FieldLabel htmlFor="destination">Destino</FieldLabel>
          <Input
            id="destination"
            name="destination"
            required
            placeholder="Ej. Plaza Shopping"
            onChange={onLegChange}
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
          onChange={onLegChange}
        />
        <FieldError>{fields?.["legs.0.scheduledAt"]?.[0]}</FieldError>
      </Field>

      <Field orientation="horizontal">
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {TRIP_MODE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => onRoundTripChange(opt.value)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                roundTrip === opt.value
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Field>

      {roundTrip && (
        <Field data-invalid={Boolean(fields?.["legs.1.scheduledAt"])}>
          <FieldLabel htmlFor="returnAt">Fecha y hora de vuelta</FieldLabel>
          <Input
            id="returnAt"
            name="returnAt"
            type="datetime-local"
            required={roundTrip}
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
