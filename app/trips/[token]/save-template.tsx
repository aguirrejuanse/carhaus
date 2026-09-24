"use client";

/**
 * "Save as template" control on the trip confirmation page (spec: "Save
 * Recurring Template"). Requires the `carhaus_rider` session cookie set by
 * `POST /api/trips` — without it the API returns 401 and we show a hint.
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/errors";
import { useSaveTemplateMutation } from "@/app/_hooks/use-save-template-mutation";
import type { SaveTemplateInput } from "@/lib/services/templates";

interface Props {
  legs: SaveTemplateInput["legs"];
  extras: SaveTemplateInput["extras"];
  defaultName: string;
}

export function SaveTemplateButton({ legs, extras, defaultName }: Props) {
  const save = useSaveTemplateMutation();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name =
      String(new FormData(event.currentTarget).get("name") ?? "").trim() ||
      defaultName;
    save.mutate({ name, legs, extras });
  };

  if (save.isSuccess) {
    return (
      <p className="text-sm font-medium text-foreground">
        Guardada como plantilla — la próxima vez la podés repetir en un click.
      </p>
    );
  }

  const errorMessage =
    save.error instanceof ApiError && save.error.status === 401
      ? "Necesitás una sesión de reserva activa para guardar plantillas."
      : save.isError
        ? "No pudimos guardar la plantilla. Probá de nuevo."
        : null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          name="name"
          defaultValue={defaultName}
          aria-label="Nombre de la plantilla"
          className="max-w-xs"
        />
        <Button type="submit" variant="outline" disabled={save.isPending}>
          {save.isPending ? "Guardando…" : "Guardar plantilla"}
        </Button>
      </div>
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
