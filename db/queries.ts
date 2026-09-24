import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  admins,
  pricingRules,
  tripExtras,
  tripLegs,
  trips,
  users,
  type SnackChoice,
  type TripType,
} from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import type { PricingRules } from "@/lib/pricing";

/**
 * `pricing_rules` rows are versioned — a rate change inserts a new row
 * rather than updating in place, so there is no natural unique key. The
 * active rule set is simply the most recently updated row (KISS: newest
 * wins). Dedicated rate-management UI is out of MVP scope.
 */
export async function getActivePricingRules(): Promise<PricingRules> {
  const [row] = await db
    .select()
    .from(pricingRules)
    .orderBy(desc(pricingRules.updatedAt))
    .limit(1);

  if (!row) {
    throw new ApiError(
      500,
      "pricing_rules_missing",
      "No pricing rules configured",
    );
  }

  return row;
}

/**
 * Email-keyed identity (spec: "Email-Keyed Identity") — find-or-create by
 * email, never duplicates a returning rider. `onConflictDoUpdate` with a
 * no-op set keeps this a single round-trip that always returns the row.
 */
export async function upsertUserByEmail(email: string) {
  const [user] = await db
    .insert(users)
    .values({ email })
    .onConflictDoUpdate({ target: users.email, set: { email } })
    .returning();
  return user;
}

export interface NewBookingLeg {
  sequence: number;
  origin: string;
  destination: string;
  scheduledAt: Date;
  distanceMeters: number;
  durationSeconds: number;
  priceCents: number;
}

export interface NewBookingExtras {
  snackChoice: SnackChoice;
  spotifyPlaylistUrl?: string;
  acTemperatureCelsius?: number;
}

/**
 * Persists a trip + its legs + extras in one neon-http batch transaction
 * (design decision #9: batch writes, not interactive transactions). The
 * trip id is generated here so the child inserts can reference it before
 * the batch executes.
 */
export async function createTripBooking(input: {
  userId: string;
  tripType: TripType;
  totalPriceCents: number;
  legs: NewBookingLeg[];
  extras: NewBookingExtras;
}): Promise<{ id: string; publicToken: string }> {
  const tripId = crypto.randomUUID();

  const [tripRows] = await db.batch([
    db
      .insert(trips)
      .values({
        id: tripId,
        userId: input.userId,
        tripType: input.tripType,
        totalPriceCents: input.totalPriceCents,
      })
      .returning({ publicToken: trips.publicToken }),
    db.insert(tripLegs).values(
      input.legs.map((leg) => ({ ...leg, tripId })),
    ),
    db.insert(tripExtras).values({ tripId, ...input.extras }),
  ]);

  return { id: tripId, publicToken: tripRows[0].publicToken };
}

/** Admin login lookup — the only place `passwordHash` is read. */
export async function getAdminByEmail(email: string) {
  const [admin] = await db
    .select()
    .from(admins)
    .where(eq(admins.email, email))
    .limit(1);
  return admin ?? null;
}

/** Public confirmation page lookup (design decision #8: unguessable link). */
export async function getTripByPublicToken(token: string) {
  return await db.query.trips.findFirst({
    where: eq(trips.publicToken, token),
    with: {
      legs: { orderBy: (leg, { asc: ascOrder }) => ascOrder(leg.sequence) },
      extras: true,
      user: { columns: { email: true } },
    },
  });
}
