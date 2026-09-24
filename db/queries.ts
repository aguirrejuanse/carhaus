import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  admins,
  cars,
  drivers,
  notifications,
  pricingRules,
  TRIP_TYPE,
  tripExtras,
  tripLegs,
  trips,
  users,
  NOTIFICATION_CHANNEL,
  TRIP_STATUS,
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

/** Admin login lookup — the only place `passwordHash` is read. */
export async function getAdminByEmail(email: string) {
  const [admin] = await db
    .select()
    .from(admins)
    .where(eq(admins.email, email))
    .limit(1);
  return admin ?? null;
}

// -----------------------------------------------------------------------------
// Admin
// -----------------------------------------------------------------------------

/** Pending queue for the admin dashboard (spec: "Admin Review Queue"). */
export async function getPendingTrips() {
  return await db.query.trips.findMany({
    where: eq(trips.status, TRIP_STATUS.PENDING),
    orderBy: asc(trips.createdAt),
    with: {
      legs: { orderBy: (leg, { asc: ascOrder }) => ascOrder(leg.sequence) },
      extras: true,
      user: { columns: { email: true } },
    },
  });
}

/** Full admin detail for one trip (queue → approve/reject screen). */
export async function getTripForAdmin(id: string) {
  return await db.query.trips.findFirst({
    where: eq(trips.id, id),
    with: {
      legs: { orderBy: (leg, { asc: ascOrder }) => ascOrder(leg.sequence) },
      extras: true,
      user: { columns: { email: true } },
      assignedCar: true,
      assignedDriver: true,
    },
  });
}

export async function getActiveCars() {
  return await db.select().from(cars).where(eq(cars.active, true));
}

export async function getDrivers() {
  return await db.select().from(drivers);
}

/**
 * Approves a pending trip with a car/driver assignment (spec: "Approve
 * with Assignment"). Runs as one neon-http batch transaction (design
 * decision #9): the conditional `UPDATE ... WHERE status='pending'` kills
 * double-approval races, and the notification row is queued via a guarded
 * `INSERT ... SELECT` that only produces a row while the trip reads
 * `approved` inside the same transaction. Returns the updated trip, or
 * `null` when the trip wasn't pending (caller maps to `409
 * trip_not_pending`).
 */
export async function approveTrip(input: {
  tripId: string;
  carId: string;
  driverId: string;
  riderEmail: string;
}) {
  const [updated] = await db.batch([
    db
      .update(trips)
      .set({
        status: TRIP_STATUS.APPROVED,
        assignedCarId: input.carId,
        assignedDriverId: input.driverId,
        updatedAt: new Date(),
      })
      .where(
        and(eq(trips.id, input.tripId), eq(trips.status, TRIP_STATUS.PENDING)),
      )
      .returning(),
    db.insert(notifications).select(
      db
        .select({
          tripId: sql<string>`${input.tripId}::uuid`.as("trip_id"),
          channel: sql<string>`${NOTIFICATION_CHANNEL.EMAIL}`.as("channel"),
          recipient: sql<string>`${input.riderEmail}`.as("recipient"),
        })
        .from(trips)
        .where(
          and(
            eq(trips.id, input.tripId),
            eq(trips.status, TRIP_STATUS.APPROVED),
          ),
        )
        .limit(1),
    ),
  ]);

  return updated[0] ?? null;
}

/**
 * Rejects a pending trip (spec: "Reject Trip" — no notification row is
 * created). Conditional update, same race-kill as `approveTrip`.
 */
export async function rejectTrip(input: { tripId: string; reason?: string }) {
  const [updated] = await db
    .update(trips)
    .set({
      status: TRIP_STATUS.REJECTED,
      rejectionReason: input.reason ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(trips.id, input.tripId), eq(trips.status, TRIP_STATUS.PENDING)),
    )
    .returning();

  return updated ?? null;
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
