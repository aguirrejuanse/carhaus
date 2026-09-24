"use client";

/**
 * Booking form state machine: leg inputs → debounced price preview →
 * submit. The preview is re-quoted whenever the leg fields change; when
 * the distance provider is down the rider can still submit unpriced for
 * admin review (spec: "Distance Provider Failure Handling").
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import { requestPricePreview, submitTripRequest } from "./services";
import type {
  FormState,
  Preview,
  PreviewStatus,
  TripExtrasInput,
  TripLegInput,
} from "./types";

const PREVIEW_DEBOUNCE_MS = 700;

export function useBookingForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [roundTrip, setRoundTrip] = useState(false);
  const [snackChoice, setSnackChoice] = useState<string>("none");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [legsVersion, setLegsVersion] = useState(0);
  const bumpLegs = () => setLegsVersion((v) => v + 1);

  const [state, formAction, isPending] = useActionState(
    async (_prev: FormState, formData: FormData): Promise<FormState> => {
      const legs = buildLegs(formData, roundTrip);
      if (!legs) {
        return { error: "Completá origen, destino y fechas del viaje." };
      }
      try {
        const extras: TripExtrasInput = {
          snackChoice,
          spotifyPlaylistUrl:
            String(formData.get("spotifyPlaylistUrl") ?? "") || undefined,
          acTemperatureCelsius: formData.get("acTemperatureCelsius")
            ? Number(formData.get("acTemperatureCelsius"))
            : undefined,
        };
        const { publicToken } = await submitTripRequest({
          email: String(formData.get("email") ?? ""),
          quoteToken: preview?.token,
          legs,
          extras,
        });
        router.push(`/trips/${publicToken}`);
        return {};
      } catch (error) {
        if (error instanceof ApiError) {
          return { error: error.message, fields: error.fields };
        }
        return { error: "No pudimos enviar tu solicitud. Probá de nuevo." };
      }
    },
    {},
  );

  /** Debounced preview: re-quotes whenever the leg fields change. */
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const legs = buildLegs(new FormData(form), roundTrip);
    if (!legs) {
      setPreview(null);
      setPreviewStatus("idle");
      return;
    }

    let cancelled = false;
    setPreviewStatus("loading");
    const timer = setTimeout(async () => {
      try {
        const data = await requestPricePreview(legs);
        if (!cancelled) {
          setPreview(data);
          setPreviewStatus("idle");
        }
      } catch {
        if (!cancelled) {
          setPreview(null);
          setPreviewStatus("error");
        }
      }
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // formData values are read through the ref; the inputs bump this via
    // onChange -> setLegsVersion.
  }, [roundTrip, legsVersion]);

  return {
    formRef,
    formAction,
    state,
    isPending,
    roundTrip,
    setRoundTrip,
    snackChoice,
    setSnackChoice,
    preview,
    previewStatus,
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

  const legs = [
    {
      origin,
      destination,
      scheduledAt: new Date(departAt).toISOString(),
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
    });
  }

  return legs;
}
