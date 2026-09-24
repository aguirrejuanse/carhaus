"use client";

/**
 * Booking form orchestrator: leg inputs → debounced price preview →
 * submit. Request state (pending/error/data) comes from the TanStack
 * mutations — no hand-rolled status flags. When the distance provider is
 * down the preview errors and the rider can still submit unpriced for
 * admin review (spec: "Distance Provider Failure Handling").
 */

import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/errors";
import type { TripExtrasInput, TripLegInput } from "@/lib/services/booking";
import {
  useCreateTripMutation,
  type CreateTripParams,
} from "@/app/_hooks/use-create-trip-mutation";
import { useTripPreviewMutation } from "@/app/_hooks/use-trip-preview-mutation";
import type { BookingInitial } from "./types";

const PREVIEW_DEBOUNCE_MS = 700;

export function useBookingForm(initial?: BookingInitial) {
  const formRef = useRef<HTMLFormElement>(null);
  const [roundTrip, setRoundTrip] = useState(initial?.roundTrip ?? false);
  const [snackChoice, setSnackChoice] = useState<string>(
    initial?.snackChoice ?? "none",
  );
  const [legsVersion, setLegsVersion] = useState(0);
  const bumpLegs = () => setLegsVersion((v) => v + 1);
  const [validationError, setValidationError] = useState<string>();

  const preview = useTripPreviewMutation();
  const createTrip = useCreateTripMutation();

  // Anonymous submit → 401 → keep the payload + email and hand off to the
  // OTP step; `retryBooking` resubmits once `carhaus_rider` is set.
  const [pending, setPending] = useState<{
    email: string;
    payload: CreateTripParams;
  } | null>(null);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const legs = buildLegs(formData, roundTrip);
    if (!legs) {
      setValidationError("Completá origen, destino y fechas del viaje.");
      return;
    }
    if (legs.length === 2 && legs[1].scheduledAt <= legs[0].scheduledAt) {
      setValidationError("La vuelta tiene que ser después de la ida.");
      return;
    }
    setValidationError(undefined);

    const extras: TripExtrasInput = {
      snackChoice,
      spotifyPlaylistUrl:
        String(formData.get("spotifyPlaylistUrl") ?? "") || undefined,
      acTemperatureCelsius: formData.get("acTemperatureCelsius")
        ? Number(formData.get("acTemperatureCelsius"))
        : undefined,
    };
    const payload: CreateTripParams = {
      quoteToken: preview.data?.token,
      legs,
      extras,
    };
    setPending({
      email: String(formData.get("email") ?? ""),
      payload,
    });
    createTrip.mutate(payload);
  };

  const retryBooking = () => {
    if (pending) createTrip.mutate(pending.payload);
  };

  /** Debounced preview: re-quotes whenever the leg fields change. */
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const legs = buildLegs(new FormData(form), roundTrip);
    if (!legs) {
      preview.reset();
      return;
    }

    const timer = setTimeout(() => preview.mutate(legs), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // formData values are read through the ref; the inputs bump this via
    // onChange -> setLegsVersion. `preview` is a stable mutation object.
  }, [roundTrip, legsVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const apiError = createTrip.error instanceof ApiError ? createTrip.error : null;
  const needsVerification = pending !== null && apiError?.status === 401;

  return {
    formRef,
    onSubmit,
    isPending: createTrip.isPending,
    needsVerification,
    verificationEmail: pending?.email,
    retryBooking,
    error:
      validationError ??
      apiError?.message ??
      (createTrip.isError
        ? "No pudimos enviar tu solicitud. Probá de nuevo."
        : undefined),
    fields: apiError?.fields,
    roundTrip,
    setRoundTrip,
    snackChoice,
    setSnackChoice,
    preview: preview.data ?? null,
    previewStatus: preview.isPending
      ? ("loading" as const)
      : preview.isError
        ? ("error" as const)
        : ("idle" as const),
    bumpLegs,
  };
}

/** Reads the leg fields out of the form; returns null until the minimum
 *  required values for a preview are present. */
function buildLegs(
  formData: FormData,
  roundTrip: boolean,
): TripLegInput[] | null {
  const origin = String(formData.get("origin") ?? "").trim();
  const destination = String(formData.get("destination") ?? "").trim();
  const departAt = String(formData.get("departAt") ?? "");
  if (!origin || !destination || !departAt) return null;

  // place_ids picked from autocomplete — the round-trip leg swaps them
  // along with the addresses.
  const originPlaceId =
    String(formData.get("originPlaceId") ?? "") || undefined;
  const destinationPlaceId =
    String(formData.get("destinationPlaceId") ?? "") || undefined;

  const legs = [
    {
      origin,
      destination,
      scheduledAt: new Date(departAt).toISOString(),
      originPlaceId,
      destinationPlaceId,
    },
  ];

  if (roundTrip) {
    const returnAt = String(formData.get("returnAt") ?? "");
    // No preview/submit until the return time is set — a 1-leg quote must
    // never be paired with a 2-leg request.
    if (!returnAt) return null;
    legs.push({
      origin: destination,
      destination: origin,
      scheduledAt: new Date(returnAt).toISOString(),
      originPlaceId: destinationPlaceId,
      destinationPlaceId: originPlaceId,
    });
  }

  return legs;
}
