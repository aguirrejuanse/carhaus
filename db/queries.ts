import "server-only";
import { and, asc, count, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  admins,
  cars,
  drivers,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_STATUS,
  notifications,
  pricingRules,
  TRIP_STATUS,
  TRIP_TYPE,
  tripExtras,
  tripLegs,
  tripTemplates,
  trips,
  users,
  verificationCodes,
  type SnackChoice,
  type TemplateLeg,
  type TripStatus,
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

/**
 * Admin dashboard list by status (spec: "Admin Review Queue"). Pending
 * sorts oldest-first (FIFO review); resolved trips newest-first.
 */
export async function getTripsByStatus(status: TripStatus) {
  return await db.query.trips.findMany({
    where: eq(trips.status, status),
    orderBy:
      status === TRIP_STATUS.PENDING
        ? asc(trips.createdAt)
        : desc(trips.createdAt),
    with: {
      legs: { orderBy: (leg, { asc: ascOrder }) => ascOrder(leg.sequence) },
      extras: true,
      user: { columns: { email: true } },
    },
  });
}

/** Per-status counts for the admin queue tabs. */
export async function getTripCountsByStatus() {
  const rows = await db
    .select({ status: trips.status, count: count() })
    .from(trips)
    .groupBy(trips.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.count])) as Partial<
    Record<TripStatus, number>
  >;
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
 * with Assignment"). One atomic statement (a data-modifying CTE — design
 * decision #9): the conditional `UPDATE ... WHERE status='pending'` kills
 * double-approval races, and the notification row is inserted FROM the
 * update's own RETURNING rows, so it only exists when this call actually
 * flipped the trip to approved (an already-approved trip produces zero
 * `upd` rows → zero notifications). Returns the updated row, or `null`
 * when the trip wasn't pending (caller maps to `409 trip_not_pending`).
 *
 * Raw `sql` because neon-http has no interactive transactions and
 * drizzle's typed `insert().select()` requires selecting the table's
 * full column list — the CTE expresses the same atomicity in a single
 * statement.
 */
export async function approveTrip(input: {
  tripId: string;
  carId: string;
  driverId: string;
  riderEmail: string;
}) {
  const result = await db.execute(sql`
    WITH upd AS (
      UPDATE trips
      SET status = ${TRIP_STATUS.APPROVED},
          assigned_car_id = ${input.carId}::uuid,
          assigned_driver_id = ${input.driverId}::uuid,
          updated_at = now()
      WHERE id = ${input.tripId}::uuid AND status = ${TRIP_STATUS.PENDING}
      RETURNING *
    ), ins AS (
      INSERT INTO notifications (trip_id, channel, recipient)
      SELECT id, ${NOTIFICATION_CHANNEL.EMAIL}, ${input.riderEmail}
      FROM upd
    )
    SELECT * FROM upd
  `);

  return (result.rows[0] ?? null) as Record<string, unknown> | null;
}

/**
 * Rejects a pending trip (spec: "Reject Trip"). Same atomic CTE as
 * `approveTrip`: the conditional UPDATE races-kills double-resolution and
 * the notification row is inserted FROM `upd` — dispatched afterwards.
 */
export async function rejectTrip(input: {
  tripId: string;
  reason?: string;
  riderEmail: string;
}) {
  const result = await db.execute(sql`
    WITH upd AS (
      UPDATE trips
      SET status = ${TRIP_STATUS.REJECTED},
          rejection_reason = ${input.reason ?? null},
          updated_at = now()
      WHERE id = ${input.tripId}::uuid AND status = ${TRIP_STATUS.PENDING}
      RETURNING *
    ), ins AS (
      INSERT INTO notifications (trip_id, channel, recipient)
      SELECT id, ${NOTIFICATION_CHANNEL.EMAIL}, ${input.riderEmail}
      FROM upd
    )
    SELECT * FROM upd
  `);

  return (result.rows[0] ?? null) as Record<string, unknown> | null;
}

// Notifications — dispatched outside the approval transaction (design
// "Data Flow"): `approveTrip` queues the row; `dispatchApprovalNotification`
// sends and marks the outcome here.

/** Latest pending email notification for a trip — what approveTrip queues. */
export async function getPendingEmailNotification(tripId: string) {
  const [row] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.tripId, tripId),
        eq(notifications.channel, NOTIFICATION_CHANNEL.EMAIL),
        eq(notifications.status, NOTIFICATION_STATUS.PENDING),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(1);
  return row ?? null;
}

export async function markNotificationSent(id: string) {
  await db
    .update(notifications)
    .set({ status: NOTIFICATION_STATUS.SENT, sentAt: new Date() })
    .where(eq(notifications.id, id));
}

export async function markNotificationFailed(id: string, message: string) {
  await db
    .update(notifications)
    .set({ status: NOTIFICATION_STATUS.FAILED, errorMessage: message })
    .where(eq(notifications.id, id));
}

// Verification codes (email OTP) — one active code per email, enforced by
// the unique constraint; a re-request upserts and resets attempts.

export async function replaceVerificationCode(input: {
  email: string;
  codeHash: string;
  requestIp?: string;
  expiresAt: Date;
}) {
  const [inserted] = await db
    .insert(verificationCodes)
    .values(input)
    .onConflictDoUpdate({
      target: verificationCodes.email,
      set: {
        codeHash: input.codeHash,
        requestIp: input.requestIp,
        expiresAt: input.expiresAt,
        attempts: 0,
        createdAt: new Date(),
      },
    })
    .returning();
  return inserted ?? null;
}

/** OTP requests from one IP inside `windowMs` — caps spraying codes at
 *  many different emails (each request leaves its row behind). */
export async function countRecentVerificationRequests(
  ip: string,
  windowMs: number,
) {
  const [row] = await db
    .select({ count: count() })
    .from(verificationCodes)
    .where(
      and(
        eq(verificationCodes.requestIp, ip),
        gt(verificationCodes.createdAt, new Date(Date.now() - windowMs)),
      ),
    );
  return row?.count ?? 0;
}

/** Latest active code for an email — expiry is checked by the caller so a
 *  stale row can still be cleaned up deterministically. */
export async function getLatestVerificationCode(email: string) {
  const [row] = await db
    .select()
    .from(verificationCodes)
    .where(eq(verificationCodes.email, email))
    .orderBy(desc(verificationCodes.createdAt))
    .limit(1);
  return row ?? null;
}

export async function bumpVerificationAttempts(id: string) {
  await db
    .update(verificationCodes)
    .set({ attempts: sql`${verificationCodes.attempts} + 1` })
    .where(eq(verificationCodes.id, id));
}

export async function deleteVerificationCode(id: string) {
  await db.delete(verificationCodes).where(eq(verificationCodes.id, id));
}

// Templates (spec: "Save Recurring Template", "Session-Scoped Template
// Listing") — scoped by rider email, resolved from the session cookie.

export async function listTemplatesByRiderEmail(riderEmail: string) {
  return await db
    .select()
    .from(tripTemplates)
    .where(eq(tripTemplates.riderEmail, riderEmail))
    .orderBy(desc(tripTemplates.createdAt));
}

export async function createTemplate(input: {
  riderEmail: string;
  name: string;
  tripType: TripType;
  legs: TemplateLeg[];
  snackChoice: SnackChoice;
  spotifyPlaylistUrl?: string;
  acTemperatureCelsius?: number;
}) {
  const [template] = await db
    .insert(tripTemplates)
    .values(input)
    .returning();
  return template;
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
      assignedCar: { columns: { make: true, model: true, plate: true } },
      assignedDriver: { columns: { name: true, phone: true } },
    },
  });
}
