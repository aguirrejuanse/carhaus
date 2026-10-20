import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

// -----------------------------------------------------------------------------
// Enums (const-object-then-type pattern, see `typescript` skill)
// -----------------------------------------------------------------------------

export const TRIP_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;
export type TripStatus = (typeof TRIP_STATUS)[keyof typeof TRIP_STATUS];
export const tripStatusEnum = pgEnum("trip_status", [
  TRIP_STATUS.PENDING,
  TRIP_STATUS.APPROVED,
  TRIP_STATUS.REJECTED,
]);

export const TRIP_TYPE = {
  ONE_WAY: "one_way",
  ROUND_TRIP: "round_trip",
} as const;
export type TripType = (typeof TRIP_TYPE)[keyof typeof TRIP_TYPE];
export const tripTypeEnum = pgEnum("trip_type", [
  TRIP_TYPE.ONE_WAY,
  TRIP_TYPE.ROUND_TRIP,
]);

export const SNACK_CHOICE = {
  NONE: "none",
  SWEET: "sweet",
  SALTY: "salty",
  MIXED: "mixed",
} as const;
export type SnackChoice = (typeof SNACK_CHOICE)[keyof typeof SNACK_CHOICE];
export const snackChoiceEnum = pgEnum("snack_choice", [
  SNACK_CHOICE.NONE,
  SNACK_CHOICE.SWEET,
  SNACK_CHOICE.SALTY,
  SNACK_CHOICE.MIXED,
]);

export const NOTIFICATION_CHANNEL = {
  EMAIL: "email",
  WHATSAPP: "whatsapp",
} as const;
export type NotificationChannel =
  (typeof NOTIFICATION_CHANNEL)[keyof typeof NOTIFICATION_CHANNEL];
export const notificationChannelEnum = pgEnum("notification_channel", [
  NOTIFICATION_CHANNEL.EMAIL,
  NOTIFICATION_CHANNEL.WHATSAPP,
]);

export const NOTIFICATION_STATUS = {
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed",
} as const;
export type NotificationStatus =
  (typeof NOTIFICATION_STATUS)[keyof typeof NOTIFICATION_STATUS];
export const notificationStatusEnum = pgEnum("notification_status", [
  NOTIFICATION_STATUS.PENDING,
  NOTIFICATION_STATUS.SENT,
  NOTIFICATION_STATUS.FAILED,
]);

// -----------------------------------------------------------------------------
// Tables
// -----------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const admins = pgTable("admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const cars = pgTable("cars", {
  id: uuid("id").primaryKey().defaultRandom(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  plate: text("plate").notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const drivers = pgTable("drivers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const trips = pgTable(
  "trips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    status: tripStatusEnum("status").notNull().default(TRIP_STATUS.PENDING),
    tripType: tripTypeEnum("trip_type").notNull(),
    publicToken: text("public_token")
      .notNull()
      .unique()
      .$defaultFn(() => nanoid(24)),
    assignedCarId: uuid("assigned_car_id").references(() => cars.id),
    assignedDriverId: uuid("assigned_driver_id").references(() => drivers.id),
    totalPriceCents: integer("total_price_cents").notNull(),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Approved trips must have both car and driver assigned (design decision #6).
    check(
      "trips_approved_requires_assignment",
      sql`(${table.status} <> 'approved') OR (${table.assignedCarId} IS NOT NULL AND ${table.assignedDriverId} IS NOT NULL)`,
    ),
  ],
);

export const tripLegs = pgTable(
  "trip_legs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    // Exactly 2 fixed legs (ida/vuelta) per MVP scope decision — sequence 1 or 2.
    sequence: smallint("sequence").notNull(),
    origin: text("origin").notNull(),
    destination: text("destination").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    distanceMeters: integer("distance_meters").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    priceCents: integer("price_cents").notNull(),
  },
  (table) => [
    unique("trip_legs_trip_sequence_unique").on(table.tripId, table.sequence),
    check("trip_legs_sequence_check", sql`${table.sequence} IN (1, 2)`),
  ],
);

export const tripExtras = pgTable("trip_extras", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .unique()
    .references(() => trips.id, { onDelete: "cascade" }),
  snackChoice: snackChoiceEnum("snack_choice")
    .notNull()
    .default(SNACK_CHOICE.NONE),
  spotifyPlaylistUrl: text("spotify_playlist_url"),
  acTemperatureCelsius: integer("ac_temperature_celsius"),
});

export const pricingRules = pgTable("pricing_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  baseFareCents: integer("base_fare_cents").notNull(),
  perKmCents: integer("per_km_cents").notNull(),
  perMinuteCents: integer("per_minute_cents").notNull(),
  minimumFareCents: integer("minimum_fare_cents").notNull(),
  // Stored as integer basis points (e.g. 1500 = 1.5x) to avoid float drift.
  nightMultiplierBasisPoints: integer("night_multiplier_basis_points")
    .notNull()
    .default(10000),
  nightStartHour: smallint("night_start_hour").notNull().default(22),
  nightEndHour: smallint("night_end_hour").notNull().default(6),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  channel: notificationChannelEnum("channel").notNull(),
  status: notificationStatusEnum("status")
    .notNull()
    .default(NOTIFICATION_STATUS.PENDING),
  recipient: text("recipient").notNull(),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Brute-force cap on admin login — each attempt leaves a row; the route
 *  429s an IP past the window limit (see app/api/admin/login). */
export const adminLoginAttempts = pgTable(
  "admin_login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ip: text("ip").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("admin_login_attempts_ip_idx").on(t.ip)],
);

/** Per-IP cap on public price previews — each preview calls billable
 *  provider APIs, so the route 429s an IP past the window limit (see
 *  app/api/pricing/preview). Same bookkeeping pattern as
 *  admin_login_attempts. */
export const pricingPreviewRequests = pgTable(
  "pricing_preview_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ip: text("ip").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("pricing_preview_requests_ip_idx").on(t.ip)],
);

/** One active code per email — the unique constraint enforces it (the
 *  upsert in db/queries.ts resets attempts on re-request). Codes are
 *  stored HMAC-hashed, expire in 10 min, and allow max 5 verify attempts.
 *  `requestIp` feeds the per-IP request cap. */
export const verificationCodes = pgTable("verification_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  requestIp: text("request_ip"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export interface TemplateLeg {
  sequence: 1 | 2;
  origin: string;
  destination: string;
}

export const tripTemplates = pgTable("trip_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  riderEmail: text("rider_email").notNull(),
  name: text("name").notNull(),
  tripType: tripTypeEnum("trip_type").notNull(),
  // Array of TemplateLeg — no scheduledAt/price here, re-request always
  // re-runs price preview.
  legs: jsonb("legs").$type<TemplateLeg[]>().notNull(),
  snackChoice: snackChoiceEnum("snack_choice")
    .notNull()
    .default(SNACK_CHOICE.NONE),
  spotifyPlaylistUrl: text("spotify_playlist_url"),
  acTemperatureCelsius: integer("ac_temperature_celsius"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// -----------------------------------------------------------------------------
// Relations
// -----------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  trips: many(trips),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  user: one(users, { fields: [trips.userId], references: [users.id] }),
  assignedCar: one(cars, {
    fields: [trips.assignedCarId],
    references: [cars.id],
  }),
  assignedDriver: one(drivers, {
    fields: [trips.assignedDriverId],
    references: [drivers.id],
  }),
  legs: many(tripLegs),
  extras: one(tripExtras, {
    fields: [trips.id],
    references: [tripExtras.tripId],
  }),
  notifications: many(notifications),
}));

export const tripLegsRelations = relations(tripLegs, ({ one }) => ({
  trip: one(trips, { fields: [tripLegs.tripId], references: [trips.id] }),
}));

export const tripExtrasRelations = relations(tripExtras, ({ one }) => ({
  trip: one(trips, { fields: [tripExtras.tripId], references: [trips.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  trip: one(trips, { fields: [notifications.tripId], references: [trips.id] }),
}));

export const carsRelations = relations(cars, ({ many }) => ({
  trips: many(trips),
}));

export const driversRelations = relations(drivers, ({ many }) => ({
  trips: many(trips),
}));
