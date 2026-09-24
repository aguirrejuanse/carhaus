/**
 * Templates API services — single place that knows the HTTP contract for
 * `GET`/`POST /api/templates` (spec: "Save Recurring Template",
 * "Session-Scoped Template Listing").
 */

import { apiFetch } from "@/lib/api-client";
import type { TemplateLeg } from "@/db/schema";

export interface TemplateItem {
  id: string;
  name: string;
  legs: TemplateLeg[];
  snackChoice: string;
  spotifyPlaylistUrl: string | null;
  acTemperatureCelsius: number | null;
}

export interface SaveTemplateInput {
  name: string;
  legs: Array<{ origin: string; destination: string }>;
  extras: {
    snackChoice: string;
    spotifyPlaylistUrl?: string;
    acTemperatureCelsius?: number;
  };
}

export function listTemplates(): Promise<{ templates: TemplateItem[] }> {
  return apiFetch("/api/templates", { method: "GET" });
}

export function saveTemplate(
  input: SaveTemplateInput,
): Promise<{ template: TemplateItem }> {
  return apiFetch("/api/templates", { body: input });
}
