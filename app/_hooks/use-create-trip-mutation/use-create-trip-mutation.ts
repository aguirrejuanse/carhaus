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
  email: string;
  quoteToken?: string;
  legs: TripLegInput[];
  extras: TripExtrasInput;
}

export function useCreateTripMutation() {
  const router = useRouter();

  return useMutation({
    mutationFn: (params: CreateTripParams) => submitTripRequest(params),
    onSuccess: ({ publicToken }) => {
      router.push(`/trips/${publicToken}`);
    },
  });
}
