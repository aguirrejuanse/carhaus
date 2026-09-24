/**
 * CSRF replacement for the Route Handler mutation boundary (design decision
 * #3: "CSRF replacement"). Next middleware alone has been bypassable
 * (`x-middleware-subrequest`, CVE-2025-29927), so this guard must run
 * inside every non-GET handler via `mutationRoute()`, not only in
 * `middleware.ts`.
 */

import type { NextRequest } from "next/server";
import { ApiError } from "./errors";

/**
 * Requires the request's `Origin` header to be present and to point at the
 * host that received the request — the literal definition of same-origin.
 *
 * Comparing against `APP_ORIGIN`/`VERCEL_URL` breaks Vercel previews: the
 * branch alias (`carhaus-git-…`) and the deployment URL (`carhaus-xxxx…`)
 * are different hosts serving the same deployment, so a strict env
 * comparison 403s legitimate browser requests. Host equality cannot be
 * forged by a cross-origin attacker: the victim's browser always sends the
 * real target host.
 */
export function assertSameOrigin(req: NextRequest): void {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host") ?? req.nextUrl.host;

  let originHost: string | null = null;
  if (origin) {
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
  }

  if (!originHost || originHost !== host) {
    throw new ApiError(
      403,
      "csrf_origin_mismatch",
      "Origin header is missing or does not match the expected origin",
    );
  }
}
