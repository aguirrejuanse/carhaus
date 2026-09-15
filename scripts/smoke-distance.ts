/**
 * One-off manual smoke test against the real Google Distance Matrix API,
 * using real Mendoza routes to sanity-check distance/duration AND the
 * resulting price against Uber/Cabify. Not part of the automated suite —
 * GoogleDistanceProvider/pricing logic is already covered by mocked-fetch
 * unit tests (lib/distance.test.ts, lib/pricing.test.ts).
 *
 * Usage: pnpm tsx scripts/smoke-distance.ts
 */
import { config } from "dotenv";
import { GoogleDistanceProvider } from "../lib/distance";
import { type PricingRules, priceLeg } from "../lib/pricing";

config({ path: ".env.local" });

const ORIGIN = "9 de Julio 1276, Jesus Nazareno, Guaymallen, Mendoza";

const DESTINATIONS = [
  "Mendoza Plaza Shopping, Mendoza",
  "Antares Aristides, Mendoza",
  "Palmares Open Mall, Mendoza",
  "Hotel Potrerillos, Mendoza",
];

// Proposed new rates — NOT yet written to db/seed.ts, pending confirmation.
const RULES: PricingRules = {
  baseFareCents: 150000,
  perKmCents: 55000,
  perMinuteCents: 12000,
  minimumFareCents: 250000,
  nightMultiplierBasisPoints: 15000,
  nightStartHour: 22,
  nightEndHour: 6,
};

function formatARS(cents: number): string {
  return `$${(cents / 100).toLocaleString("es-AR")}`;
}

async function main() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is not set (check .env.local)");
  }

  const provider = new GoogleDistanceProvider(apiKey);

  for (const destination of DESTINATIONS) {
    const distance = await provider.getDistance(ORIGIN, destination);
    const price = priceLeg(
      { ...distance, scheduledAt: new Date() },
      RULES,
    );

    console.log(`\n${destination}`);
    console.log(`  ${(distance.distanceMeters / 1000).toFixed(1)} km, ${Math.round(distance.durationSeconds / 60)} min`);
    console.log(`  price: ${formatARS(price.priceCents)}${price.isNightRate ? " (night rate)" : ""}`);
  }
}

main().catch((error) => {
  console.error("Smoke test failed:", error);
  process.exit(1);
});
