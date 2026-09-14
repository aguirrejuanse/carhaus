import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_STATUS,
  SNACK_CHOICE,
  TRIP_STATUS,
  TRIP_TYPE,
  admins,
  cars,
  drivers,
  notifications,
  pricingRules,
  tripExtras,
  tripLegs,
  tripTemplates,
  trips,
  users,
} from "./schema";

describe("schema", () => {
  it("defines exactly the 10 tables required for the MVP", () => {
    const tables = {
      users,
      admins,
      cars,
      drivers,
      trips,
      tripLegs,
      tripExtras,
      pricingRules,
      notifications,
      tripTemplates,
    };
    expect(Object.keys(tables)).toHaveLength(10);
  });

  it("trip status enum matches the spec (pending/approved/rejected)", () => {
    expect(Object.values(TRIP_STATUS).sort()).toEqual(
      ["approved", "pending", "rejected"].sort(),
    );
  });

  it("trip type enum matches one-way / fixed 2-leg round trip", () => {
    expect(Object.values(TRIP_TYPE).sort()).toEqual(
      ["one_way", "round_trip"].sort(),
    );
  });

  it("notification channel/status enums cover email + whatsapp dispatch", () => {
    expect(Object.values(NOTIFICATION_CHANNEL).sort()).toEqual(
      ["email", "whatsapp"].sort(),
    );
    expect(Object.values(NOTIFICATION_STATUS).sort()).toEqual(
      ["failed", "pending", "sent"].sort(),
    );
  });

  it("snack choice enum is a closed set", () => {
    expect(Object.values(SNACK_CHOICE)).toEqual([
      "none",
      "sweet",
      "salty",
      "mixed",
    ]);
  });
});
