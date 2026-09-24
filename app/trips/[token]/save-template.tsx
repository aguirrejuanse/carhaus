"use client";

/**
 * "Save as template" control on the trip confirmation page (spec: "Save
 * Recurring Template"). Requires the `carhaus_rider` session cookie set by
 * `POST /api/trips` — without it the API returns 401 and we show a hint.
 */

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/errors";
import { apiFetch } from "@/lib/api-client";

interface Props {
  legs: Array<{ origin: string; destination: string }>;
  extras: {
    snackChoice: string;
    spotifyPlaylistUrl?: string;
    acTemperatureCelsius?: number;
  };
  defaultName: string;
}

interface FormState {
  error?: string;
  saved?: boolean;
}

export function SaveTemplateButton({ legs, extras, defaultName }: Props) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: FormState, formData: FormData): Promise<FormState> => {
      try {
        await apiFetch("/api/templates", {
          body: {
            name: String(formData.get("name") ?? defaultName),
            legs,
            extras,
          },
        });
        return { saved: true };
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return {
            error:
              "Necesitás una sesión de reserva activa para guardar plantillas.",
          };
        }
        return { error: "No pudimos guardar la plantilla. Probá de nuevo." };
      }
    },
    {},
  );

  if (state.saved) {
    return (
      <p className="text-sm font-medium text-foreground">
        Guardada como plantilla — la próxima vez la podés repetir en un click.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          name="name"
          defaultValue={defaultName}
          aria-label="Nombre de la plantilla"
          className="max-w-xs"
        />
        <Button type="submit" variant="outline" disabled={isPending}>
          {isPending ? "Guardando…" : "Guardar plantilla"}
        </Button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
