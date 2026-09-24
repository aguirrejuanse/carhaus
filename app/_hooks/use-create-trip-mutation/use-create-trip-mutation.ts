"use client";

/** POST /api/trips — creates the booking, then routes to the public
 *  confirmation page. */

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  return useMutation({
    mutationFn: (params: CreateTripParams) => submitTripRequest(params),
    onSuccess: ({ publicToken }) => {
      // refresh() before push — a just-verified rider would otherwise see
      // the stale anonymous header (cached layout) on the confirmation.
      router.refresh();
      router.push(`/trips/${publicToken}`);
    },
  });
}
