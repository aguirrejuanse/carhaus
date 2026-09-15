import { describe, expect, it } from "vitest";
import { APP_TIMEZONE, type PricingRules, priceLeg, priceTrip } from "./pricing";

const baseRules: PricingRules = {
  baseFareCents: 1000,
  perKmCents: 100,
  perMinuteCents: 20,
  minimumFareCents: 1500,
  nightMultiplierBasisPoints: 15000, // 1.5x
  nightStartHour: 22,
  nightEndHour: 6,
};

// distance/duration chosen so the day-rate subtotal comfortably clears the
// minimum fare: base 1000 + 10km*100 + 20min*20 = 2400 cents.
const midDistanceInput = {
  distanceMeters: 10_000,
  durationSeconds: 20 * 60,
};

describe("priceLeg", () => {
  it("prices a daytime leg at the base rate with no night multiplier", () => {
    const result = priceLeg(
      { ...midDistanceInput, scheduledAt: new Date("2026-01-10T12:00:00Z") },
      baseRules,
      "UTC",
    );

    expect(result.isNightRate).toBe(false);
    expect(result.priceCents).toBe(2400);
  });

  it("applies the night multiplier at the start of the night window (22:00 local)", () => {
    const result = priceLeg(
      { ...midDistanceInput, scheduledAt: new Date("2026-01-10T22:00:00Z") },
      baseRules,
      "UTC",
    );

    expect(result.isNightRate).toBe(true);
    expect(result.priceCents).toBe(3600); // 2400 * 1.5
  });

  it("does not apply the night multiplier one minute before the window starts (21:59 local)", () => {
    const result = priceLeg(
      { ...midDistanceInput, scheduledAt: new Date("2026-01-10T21:59:00Z") },
      baseRules,
      "UTC",
    );

    expect(result.isNightRate).toBe(false);
    expect(result.priceCents).toBe(2400);
  });

  it("still applies the night rate just before the window ends (05:59 local, wraps past midnight)", () => {
    const result = priceLeg(
      { ...midDistanceInput, scheduledAt: new Date("2026-01-10T05:59:00Z") },
      baseRules,
      "UTC",
    );

    expect(result.isNightRate).toBe(true);
    expect(result.priceCents).toBe(3600);
  });

  it("stops applying the night rate exactly when the window ends (06:00 local)", () => {
    const result = priceLeg(
      { ...midDistanceInput, scheduledAt: new Date("2026-01-10T06:00:00Z") },
      baseRules,
      "UTC",
    );

    expect(result.isNightRate).toBe(false);
    expect(result.priceCents).toBe(2400);
  });

  it("resolves the night window against the real APP_TIMEZONE (America/Argentina/Buenos_Aires, UTC-3)", () => {
    // 03:00 UTC = 00:00 Buenos Aires (within the 22-6 night window).
    const nightResult = priceLeg(
      { ...midDistanceInput, scheduledAt: new Date("2026-01-10T03:00:00Z") },
      baseRules,
      APP_TIMEZONE,
    );
    expect(nightResult.isNightRate).toBe(true);
    expect(nightResult.priceCents).toBe(3600);

    // 12:00 UTC = 09:00 Buenos Aires (outside the night window).
    const dayResult = priceLeg(
      { ...midDistanceInput, scheduledAt: new Date("2026-01-10T12:00:00Z") },
      baseRules,
      APP_TIMEZONE,
    );
    expect(dayResult.isNightRate).toBe(false);
    expect(dayResult.priceCents).toBe(2400);
  });

  it("never applies the night rate when nightStartHour equals nightEndHour", () => {
    const rules: PricingRules = { ...baseRules, nightStartHour: 5, nightEndHour: 5 };

    const result = priceLeg(
      { ...midDistanceInput, scheduledAt: new Date("2026-01-10T05:00:00Z") },
      rules,
      "UTC",
    );

    expect(result.isNightRate).toBe(false);
    expect(result.priceCents).toBe(2400);
  });

  it("floors the price at the minimum fare for a very short leg", () => {
    const result = priceLeg(
      {
        distanceMeters: 500,
        durationSeconds: 60,
        scheduledAt: new Date("2026-01-10T12:00:00Z"),
      },
      baseRules,
      "UTC",
    );

    // base 1000 + 0.5km*100 + 1min*20 = 1070, below the 1500 minimum.
    expect(result.priceCents).toBe(baseRules.minimumFareCents);
  });
});

describe("priceTrip", () => {
  it("prices each leg independently and sums the total (2-leg round trip)", () => {
    const result = priceTrip(
      [
        { ...midDistanceInput, scheduledAt: new Date("2026-01-10T12:00:00Z") }, // day: 2400
        { ...midDistanceInput, scheduledAt: new Date("2026-01-10T23:00:00Z") }, // night: 3600
      ],
      baseRules,
      "UTC",
    );

    expect(result.legs).toHaveLength(2);
    expect(result.legs[0].priceCents).toBe(2400);
    expect(result.legs[1].priceCents).toBe(3600);
    expect(result.totalPriceCents).toBe(6000);
  });

  it("returns zero total for an empty leg list", () => {
    const result = priceTrip([], baseRules, "UTC");
    expect(result.legs).toEqual([]);
    expect(result.totalPriceCents).toBe(0);
  });
});
