import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  pricingRules,
  TRIP_TYPE,
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
 * no-op set keeps this a single round-trip that always returns the row —
 * it is also what makes concurrent bookings with the same email safe
 * (the unique index serializes them; one wins the insert, the other
 * updates the same row).
 */
export async function upsertUserByEmail(email: string) {
  // Case/whitespace-insensitive identity: "A@x.com" and "a@x.com " are the
  // same rider — normalizing here prevents duplicate user rows.
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw new ApiError(422, "email_required", "A rider email is required");
  }

  const [user] = await db
    .insert(users)
    .values({ email: normalized })
    .onConflictDoUpdate({ target: users.email, set: { email: normalized } })
    .returning();
  if (!user) {
    throw new ApiError(500, "user_upsert_failed", "Could not resolve rider");
  }
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
  // Domain invariants — a violation here is a server bug, not bad input
  // (callers already ran the Zod contract), so these are 500s.
  if (input.legs.length < 1 || input.legs.length > 2) {
    throw new ApiError(500, "invalid_legs", "A booking needs 1 or 2 legs");
  }
  const expectsRoundTrip = input.legs.length === 2;
  if ((input.tripType === TRIP_TYPE.ROUND_TRIP) !== expectsRoundTrip) {
    throw new ApiError(
      500,
      "trip_type_mismatch",
      "tripType does not match the number of legs",
    );
  }

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

  const trip = tripRows[0];
  if (!trip) {
    throw new ApiError(500, "trip_insert_failed", "Trip was not persisted");
  }
  return { id: tripId, publicToken: trip.publicToken };
}

/** Rider-session lookup: the `carhaus_rider` JWT carries only `userId`. */
export async function getUserById(id: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user ?? null;
}

/**
 * Rider's own trips for the confirmation page ("Tus viajes") — latest
 * first, joined to leg 1 so each row can show origin → destination.
 */
export async function getTripsByUserId(userId: string) {
  return await db
    .select({
      publicToken: trips.publicToken,
      status: trips.status,
      createdAt: trips.createdAt,
      totalPriceCents: trips.totalPriceCents,
      origin: tripLegs.origin,
      destination: tripLegs.destination,
    })
    .from(trips)
    .leftJoin(
      tripLegs,
      and(eq(tripLegs.tripId, trips.id), eq(tripLegs.sequence, 1)),
    )
    .where(eq(trips.userId, userId))
    .orderBy(desc(trips.createdAt))
    .limit(10);
}

/** Public confirmation page lookup (design decision #8: unguessable link). */
export async function getTripByPublicToken(token: string) {
  if (!token) return undefined;
  return await db.query.trips.findFirst({
    where: eq(trips.publicToken, token),
    with: {
      legs: { orderBy: (leg, { asc: ascOrder }) => ascOrder(leg.sequence) },
      extras: true,
      user: { columns: { email: true } },
    },
  });
}
