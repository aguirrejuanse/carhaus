"use client";

/** GET /api/templates — session-scoped template list. Server-rendered
 *  templates are passed as `initialData` so the landing renders without
 *  a client round-trip; saves invalidate this key. */

import { useQuery } from "@tanstack/react-query";
import { listTemplates, type TemplateItem } from "@/lib/services/templates";

export function useTemplatesQuery(initialData?: TemplateItem[]) {
  return useQuery<TemplateItem[]>({
    queryKey: ["templates"],
    queryFn: async () => (await listTemplates()).templates,
    initialData,
  });
}
