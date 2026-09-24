"use client";

/** "A tu medida" fieldset: snack choice, AC temperature, Spotify playlist. */

import {
  Field,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SNACK_LABELS } from "@/lib/labels";
import type { BookingInitial, FieldErrors } from "./types";

const SNACK_OPTIONS = Object.entries(SNACK_LABELS).map(([value, label]) => ({
  value,
  label,
}));

interface Props {
  fields: FieldErrors;
  initial?: BookingInitial;
  snackChoice: string;
  onSnackChange: (value: string) => void;
}

export function ExtrasFields({
  fields,
  initial,
  snackChoice,
  onSnackChange,
}: Props) {
  return (
    <FieldSet>
      <FieldLegend className="font-heading text-lg font-semibold tracking-tight">
        A tu medida
      </FieldLegend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel>Snack</FieldLabel>
          <Select
            items={SNACK_OPTIONS}
            value={snackChoice}
            onValueChange={(value) => onSnackChange(value ?? "none")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SNACK_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="acTemperatureCelsius">
            Aire acondicionado (°C)
          </FieldLabel>
          <Input
            id="acTemperatureCelsius"
            name="acTemperatureCelsius"
            type="number"
            min={16}
            max={30}
            step={1}
            placeholder="22"
            defaultValue={initial?.acTemperatureCelsius}
          />
        </Field>
      </div>
      <Field data-invalid={Boolean(fields?.["extras.spotifyPlaylistUrl"])}>
        <FieldLabel htmlFor="spotifyPlaylistUrl">
          Playlist de Spotify
        </FieldLabel>
        <Input
          id="spotifyPlaylistUrl"
          name="spotifyPlaylistUrl"
          type="url"
          pattern="https://.*\.spotify\.com/.*"
          title="Pegá el link de tu playlist de Spotify"
          maxLength={500}
          placeholder="https://open.spotify.com/playlist/..."
          defaultValue={initial?.spotifyPlaylistUrl}
        />
        <FieldError>{fields?.["extras.spotifyPlaylistUrl"]?.[0]}</FieldError>
      </Field>
    </FieldSet>
  );
}
