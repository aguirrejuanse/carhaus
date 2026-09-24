import "server-only";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { pricingRules } from "@/db/schema";
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
