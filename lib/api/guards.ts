/**
 * CSRF replacement for the Route Handler mutation boundary (design decision
 * #3: "CSRF replacement"). Next middleware alone has been bypassable
 * (`x-middleware-subrequest`, CVE-2025-29927), so this guard must run
 * inside every non-GET handler via `mutationRoute()`, not only in
 * `middleware.ts`.
 */

import type { NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { ApiError } from "./errors";

/**
 * Requires the request's `Origin` header to be present and strictly equal
 * to `APP_ORIGIN`. There is no third-party embed in the MVP, so exact
 * string equality is sufficient — no wildcard/subdomain matching.
 */
export function assertSameOrigin(req: NextRequest): void {
  const origin = req.headers.get("origin");
  const appOrigin = getEnv().APP_ORIGIN;

  if (!origin || origin !== appOrigin) {
    throw new ApiError(
      403,
      "csrf_origin_mismatch",
      "Origin header is missing or does not match the expected origin",
    );
  }
}
