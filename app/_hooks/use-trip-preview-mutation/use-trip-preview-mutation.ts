"use client";

/** POST /api/pricing/preview — re-quotes the current leg fields. */

import { useMutation } from "@tanstack/react-query";
import {
  requestPricePreview,
  type TripLegInput,
} from "@/lib/services/booking";

export function useTripPreviewMutation() {
  return useMutation({
    mutationFn: (legs: TripLegInput[]) => requestPricePreview(legs),
  });
}
