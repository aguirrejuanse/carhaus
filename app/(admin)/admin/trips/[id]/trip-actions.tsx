"use client";

/**
 * Approve/reject controls for the admin trip detail. `useTransition` +
 * `apiFetch` PATCH + `router.refresh()` (design "Client Convention" — no
 * `revalidatePath` from a route handler). Approval requires picking a car
 * AND a driver (spec: "Approve with Assignment" — the DB also enforces
 * this with a CHECK constraint).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/errors";
import { apiFetch } from "@/lib/api-client";

interface Fleet {
  cars: Array<{ id: string; make: string; model: string; plate: string }>;
  drivers: Array<{ id: string; name: string }>;
}

export function TripActions({
  tripId,
  cars,
  drivers,
}: { tripId: string } & Fleet) {
  const router = useRouter();
  const [carId, setCarId] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (body: Record<string, unknown>) => {
    setError(null);
    startTransition(async () => {
      try {
        await apiFetch(`/api/admin/trips/${tripId}`, {
          method: "PATCH",
          body,
        });
        router.push("/admin");
        router.refresh();
      } catch (err) {
        setError(
          err instanceof ApiError && err.code === "trip_not_pending"
            ? "Este viaje ya fue resuelto por otro admin."
            : "No se pudo guardar. Probá de nuevo.",
        );
        router.refresh();
      }
    });
  };

  return (
    <section className="flex flex-col gap-6 border-t border-border pt-8">
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>Auto</FieldLabel>
            <Select value={carId} onValueChange={setCarId}>
              <SelectTrigger>
                <SelectValue placeholder="Elegí un auto" />
              </SelectTrigger>
              <SelectContent>
                {cars.map((car) => (
                  <SelectItem key={car.id} value={car.id}>
                    {car.make} {car.model} · {car.plate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Chofer</FieldLabel>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger>
                <SelectValue placeholder="Elegí un chofer" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="reason">Motivo de rechazo (opcional)</FieldLabel>
          <Input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej. Sin disponibilidad en ese horario"
          />
        </Field>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button
            type="button"
            disabled={isPending || !carId || !driverId}
            onClick={() =>
              submit({ action: "approve", carId, driverId })
            }
          >
            Aprobar viaje
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() =>
              submit({ action: "reject", reason: reason || undefined })
            }
          >
            Rechazar
          </Button>
        </div>
      </FieldGroup>
    </section>
  );
}
