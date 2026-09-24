/**
 * Shared Spanish UI labels for domain enums — single source so forms,
 * confirmation pages, and admin views can't drift apart.
 */

import { SNACK_CHOICE, TRIP_STATUS } from "@/db/schema";

export const SNACK_LABELS: Record<string, string> = {
  [SNACK_CHOICE.NONE]: "Sin snack",
  [SNACK_CHOICE.SWEET]: "Dulce",
  [SNACK_CHOICE.SALTY]: "Salado",
  [SNACK_CHOICE.MIXED]: "Mixto",
};

export const TRIP_STATUS_LABELS: Record<string, string> = {
  [TRIP_STATUS.PENDING]: "En revisión",
  [TRIP_STATUS.APPROVED]: "Confirmado",
  [TRIP_STATUS.REJECTED]: "No disponible",
};
