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

  await db.insert(pricingRules).values({
    baseFareCents: 50000,
    perKmCents: 15000,
    perMinuteCents: 3000,
    minimumFareCents: 80000,
    nightMultiplierBasisPoints: 15000, // 1.5x
    nightStartHour: 22,
    nightEndHour: 6,
  });

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
