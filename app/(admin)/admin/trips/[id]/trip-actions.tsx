"use client";

/**
 * Approve/reject controls for the admin trip detail. `useAdminTripMutation`
 * PATCHes via `lib/services/admin` and `router.refresh()` re-renders the
 * server components (design "Client Convention" — no `revalidatePath`
 * from a route handler). Approval requires picking a car AND a driver
 * (spec: "Approve with Assignment" — the DB also enforces it with a CHECK
 * constraint).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminTripMutation } from "@/app/_hooks/use-admin-trip-mutation";
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
  const mutation = useAdminTripMutation(tripId);
  const [carId, setCarId] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  // `items` lets Select.Value render the label instead of the raw UUID.
  const carItems = cars.map((c) => ({
    value: c.id,
    label: `${c.make} ${c.model} · ${c.plate}`,
  }));
  const driverItems = drivers.map((d) => ({ value: d.id, label: d.name }));

  const apiError =
    mutation.error instanceof ApiError ? mutation.error : null;

  const submit = (input: Parameters<typeof mutation.mutate>[0]) => {
    mutation.mutate(input, {
      onSuccess: () => {
        router.push("/admin");
        router.refresh();
      },
      onError: () => router.refresh(),
    });
  };

  return (
    <section className="flex flex-col gap-6 border-t border-border pt-8">
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>Auto</FieldLabel>
            <Select
              items={carItems}
              value={carId}
              onValueChange={setCarId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Elegí un auto" />
              </SelectTrigger>
              <SelectContent>
                {carItems.map((car) => (
                  <SelectItem key={car.value} value={car.value}>
                    {car.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Chofer</FieldLabel>
            <Select
              items={driverItems}
              value={driverId}
              onValueChange={setDriverId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Elegí un chofer" />
              </SelectTrigger>
              <SelectContent>
                {driverItems.map((driver) => (
                  <SelectItem key={driver.value} value={driver.value}>
                    {driver.label}
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

        {mutation.isError && (
          <p role="alert" className="text-sm text-destructive">
            {apiError?.code === "trip_not_pending"
              ? "Este viaje ya fue resuelto por otro admin."
              : "No se pudo guardar. Probá de nuevo."}
          </p>
        )}

        <div className="flex gap-3">
          <Button
            type="button"
            disabled={mutation.isPending || !carId || !driverId}
            onClick={() =>
              submit({ action: "approve", carId: carId!, driverId: driverId! })
            }
          >
            Aprobar viaje
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
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
