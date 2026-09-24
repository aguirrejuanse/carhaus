/**
 * Demo seed — inserts pending trips with legs + extras so the admin queue
 * (`/admin`) has reviewable content without booking through the UI. Safe
 * to re-run: it deletes prior demo trips first (legs/extras/notifications
 * cascade) and re-inserts a fresh set. Demo riders live under `@demo.dev`
 * so they're trivially recognizable and never collide with real riders.
 *
 *   pnpm db:seed:demo
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { inArray } from "drizzle-orm";
import * as schema from "./schema";
import {
  SNACK_CHOICE,
  TRIP_TYPE,
  tripExtras,
  tripLegs,
  trips,
  users,
} from "./schema";

const DEMO_EMAILS = [
  "maria@demo.dev",
  "juan@demo.dev",
  "lucia@demo.dev",
] as const;

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run the demo seed");
  }

  const db = drizzle(neon(databaseUrl), { schema });

  // Demo riders — upsert by email so re-runs don't duplicate users.
  const demoUsers = await Promise.all(
    DEMO_EMAILS.map(async (email) => {
      const [user] = await db
        .insert(users)
        .values({ email })
        .onConflictDoUpdate({ target: users.email, set: { email } })
        .returning();
      return user;
    }),
  );

  // Wipe previous demo trips (cascades to legs/extras/notifications).
  await db
    .delete(trips)
    .where(
      inArray(
        trips.userId,
        demoUsers.map((u) => u.id),
      ),
    );

  const [maria, juan, lucia] = demoUsers;

  const demos: Array<{
    userId: string;
    tripType: (typeof TRIP_TYPE)[keyof typeof TRIP_TYPE];
    totalPriceCents: number;
    legs: Array<{
      sequence: number;
      origin: string;
      destination: string;
      scheduledAt: Date;
      distanceMeters: number;
      durationSeconds: number;
      priceCents: number;
    }>;
    extras: {
      snackChoice: (typeof SNACK_CHOICE)[keyof typeof SNACK_CHOICE];
      spotifyPlaylistUrl?: string;
      acTemperatureCelsius?: number;
    };
  }> = [
    {
      userId: maria.id,
      tripType: TRIP_TYPE.ONE_WAY,
      totalPriceCents: 1850000,
      legs: [
        {
          sequence: 1,
          origin: "Av. Emilio Civit 715, Mendoza",
          destination: "Aeropuerto Internacional El Plumerillo, Mendoza",
          scheduledAt: hoursFromNow(26),
          distanceMeters: 11800,
          durationSeconds: 1500,
          priceCents: 1850000,
        },
      ],
      extras: {
        snackChoice: SNACK_CHOICE.SWEET,
        spotifyPlaylistUrl: "https://open.spotify.com/playlist/demo",
      },
    },
    {
      userId: juan.id,
      tripType: TRIP_TYPE.ROUND_TRIP,
      totalPriceCents: 3120000,
      legs: [
        {
          sequence: 1,
          origin: "Av. 9 de Julio 1276, Guaymallén, Mendoza",
          destination: "Av. San Martín 1150, Ciudad, Mendoza",
          scheduledAt: hoursFromNow(50),
          distanceMeters: 9200,
          durationSeconds: 1320,
          priceCents: 1560000,
        },
        {
          sequence: 2,
          origin: "Av. San Martín 1150, Ciudad, Mendoza",
          destination: "Av. 9 de Julio 1276, Guaymallén, Mendoza",
          scheduledAt: hoursFromNow(56),
          distanceMeters: 9200,
          durationSeconds: 1320,
          priceCents: 1560000,
        },
      ],
      extras: { snackChoice: SNACK_CHOICE.SALTY, acTemperatureCelsius: 21 },
    },
    {
      userId: lucia.id,
      tripType: TRIP_TYPE.ONE_WAY,
      totalPriceCents: 2240000,
      legs: [
        {
          sequence: 1,
          origin: "Chacras de Coria, Luján de Cuyo, Mendoza",
          destination: "Cacheuta, Luján de Cuyo, Mendoza",
          scheduledAt: hoursFromNow(8),
          distanceMeters: 24500,
          durationSeconds: 2100,
          priceCents: 2240000,
        },
      ],
      extras: { snackChoice: SNACK_CHOICE.NONE },
    },
  ];

  for (const demo of demos) {
    const tripId = crypto.randomUUID();
    await db.batch([
      db.insert(trips).values({
        id: tripId,
        userId: demo.userId,
        tripType: demo.tripType,
        totalPriceCents: demo.totalPriceCents,
      }),
      db.insert(tripLegs).values(
        demo.legs.map((leg) => ({ ...leg, tripId })),
      ),
      db.insert(tripExtras).values({ tripId, ...demo.extras }),
    ]);
  }

  console.log(`Demo seed: ${demos.length} pending trips for ${DEMO_EMAILS.join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
