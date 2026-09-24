"use client";

/** POST /api/templates — saves a booking as a reusable template, then
 *  invalidates the templates list. */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  saveTemplate,
  type SaveTemplateInput,
} from "@/lib/services/templates";

export function useSaveTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: SaveTemplateInput) => saveTemplate(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}
