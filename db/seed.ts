import "dotenv/config";
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { admins, cars, drivers, pricingRules } from "./schema";
import * as schema from "./schema";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run the seed script");
  }

  const sql = neon(databaseUrl);
  const db = drizzle(sql, { schema });

  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "changeme123!";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await db
    .insert(admins)
    .values({
      email: "admin@carhaus.dev",
      passwordHash,
    })
    .onConflictDoNothing({ target: admins.email });

  // pricing_rules has no natural unique key to conflict on (rates are
  // expected to change over time, so re-running this on a live DB should
  // never silently insert a duplicate "current" row) — only seed the initial
  // row when the table is empty. Later rate changes go through a dedicated
  // admin flow, not this script.
  const existingRules = await db
    .select({ id: pricingRules.id })
    .from(pricingRules)
    .limit(1);

  if (existingRules.length === 0) {
    await db.insert(pricingRules).values({
      // Calibrated against real Uber/Cabify fares for Mendoza routes
      // (Guaymallen -> Plaza Shopping/Antares/Palmares/Potrerillos), not final.
      baseFareCents: 150000,
      perKmCents: 55000,
      perMinuteCents: 12000,
      minimumFareCents: 250000,
      nightMultiplierBasisPoints: 15000, // 1.5x
      nightStartHour: 22,
      nightEndHour: 6,
    });
  }

  await db
    .insert(cars)
    .values([
      { make: "Toyota", model: "Corolla", plate: "AB123CD" },
      { make: "VW", model: "Vento", plate: "AC456EF" },
      { make: "Chevrolet", model: "Cruze", plate: "AD789GH" },
    ])
    .onConflictDoNothing({ target: cars.plate });

  await db.insert(drivers).values([
    { name: "Martín Pérez", phone: "+5491100000001" },
    { name: "Lucía Gómez", phone: "+5491100000002" },
  ]);

  console.log("Seed completed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
