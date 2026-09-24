/**
 * Shared display formatters — money is integer cents everywhere in the
 * domain; format once here instead of re-declaring Intl instances per
 * component.
 */

const priceFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function formatCents(cents: number): string {
  return priceFormatter.format(cents / 100);
}

const legDateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

export function formatLegDateTime(date: Date): string {
  return legDateFormatter.format(date);
}
