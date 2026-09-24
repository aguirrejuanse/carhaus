"use client";

/** POST /api/trips — creates the booking, then routes to the public
 *  confirmation page. */

import { useMutation } from "@tanstack/react-query";
import {
  submitTripRequest,
  type TripExtrasInput,
  type TripLegInput,
} from "@/lib/services/booking";

export interface CreateTripParams {
  quoteToken?: string;
  legs: TripLegInput[];
  extras: TripExtrasInput;
}

export function useCreateTripMutation() {
  return useMutation({
    mutationFn: (params: CreateTripParams) => submitTripRequest(params),
    onSuccess: ({ publicToken }) => {
      // Full reload: a just-verified rider's header lives in the shared
      // root layout, and refresh()+push() races the Router Cache — the
      // anonymous "Ingresar" survives. Same precedent as LogoutButton.
      window.location.assign(`/trips/${publicToken}`);
    },
  });
}
