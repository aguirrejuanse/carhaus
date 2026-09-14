/**
 * Pure fare pricing. Money = integer cents, distance = meters, duration =
 * seconds (matches `db/schema.ts`). Night multiplier is resolved via `Intl`
 * against a fixed app timezone instead of manual UTC-offset math, so DST /
 * offset edge cases are handled by the platform's timezone database
 * (design: "night multiplier resolved via Intl in APP_TIMEZONE").
 *
 * Extras (snack/Spotify/AC) are free in MVP and do not affect price.
 */

/**
 * Fixed operating timezone for night-rate calculation. Not currently exposed
 * as an env var (out of scope for this lib) — change here if Carhaus starts
 * operating in a different region.
 */
export const APP_TIMEZONE = "America/Argentina/Buenos_Aires";

export interface PricingRules {
  baseFareCents: number;
  perKmCents: number;
  perMinuteCents: number;
  minimumFareCents: number;
  /** Basis points, e.g. 15000 = 1.5x, to avoid float drift (schema default 10000 = 1x). */
  nightMultiplierBasisPoints: number;
  /** Inclusive local hour (0-23) night pricing starts. */
  nightStartHour: number;
  /** Exclusive local hour (0-23) night pricing ends. */
  nightEndHour: number;
}

export interface LegPricingInput {
  distanceMeters: number;
  durationSeconds: number;
  /** When the leg is scheduled to depart — used to resolve the night multiplier. */
  scheduledAt: Date;
}

export interface LegPriceResult {
  priceCents: number;
  isNightRate: boolean;
}

/**
 * Resolves the local hour-of-day (0-23) for `date` in `timezone` via
 * `Intl.DateTimeFormat`, avoiding manual UTC-offset arithmetic (which breaks
 * around DST transitions).
 */
function resolveLocalHour(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });
  const hourPart = formatter.formatToParts(date).find((p) => p.type === "hour");
  const hour = hourPart ? Number.parseInt(hourPart.value, 10) : date.getUTCHours();
  // Intl can format midnight as "24" for hour12:false in some locales/engines.
  return hour === 24 ? 0 : hour;
}

/**
 * Night window may wrap around midnight (e.g. start 22, end 6). Handles both
 * wrapping (start > end) and non-wrapping (start < end) ranges.
 */
function isWithinNightWindow(
  hour: number,
  nightStartHour: number,
  nightEndHour: number,
): boolean {
  if (nightStartHour === nightEndHour) return false;
  if (nightStartHour < nightEndHour) {
    return hour >= nightStartHour && hour < nightEndHour;
  }
  return hour >= nightStartHour || hour < nightEndHour;
}

export function priceLeg(
  input: LegPricingInput,
  rules: PricingRules,
  timezone: string = APP_TIMEZONE,
): LegPriceResult {
  const distanceKm = input.distanceMeters / 1000;
  const durationMinutes = input.durationSeconds / 60;

  const subtotalCents =
    rules.baseFareCents +
    Math.round(distanceKm * rules.perKmCents) +
    Math.round(durationMinutes * rules.perMinuteCents);

  const localHour = resolveLocalHour(input.scheduledAt, timezone);
  const isNightRate = isWithinNightWindow(
    localHour,
    rules.nightStartHour,
    rules.nightEndHour,
  );

  const multipliedCents = isNightRate
    ? Math.round((subtotalCents * rules.nightMultiplierBasisPoints) / 10000)
    : subtotalCents;

  const priceCents = Math.max(multipliedCents, rules.minimumFareCents);

  return { priceCents, isNightRate };
}

export interface TripPriceResult {
  legs: LegPriceResult[];
  totalPriceCents: number;
}

/**
 * Prices each leg independently (a fixed 2-leg round trip prices ida/vuelta
 * separately since they may fall on different sides of the night window)
 * then sums — spec: "2-leg pricing".
 */
export function priceTrip(
  legs: LegPricingInput[],
  rules: PricingRules,
  timezone: string = APP_TIMEZONE,
): TripPriceResult {
  const pricedLegs = legs.map((leg) => priceLeg(leg, rules, timezone));
  const totalPriceCents = pricedLegs.reduce(
    (sum, leg) => sum + leg.priceCents,
    0,
  );

  return { legs: pricedLegs, totalPriceCents };
}
