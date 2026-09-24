/**
 * `POST /api/admin/logout` — clears the `carhaus_admin` session cookie.
 * No body: same-origin guard only (there is no payload to validate).
 */

import { jsonSuccess, toErrorResponse } from "@/lib/api/errors";
import { assertSameOrigin } from "@/lib/api/guards";
import { clearAdminSessionCookie } from "@/lib/auth";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(req);
  } catch (error) {
    return toErrorResponse(error);
  }

  const res = jsonSuccess({ ok: true });
  res.headers.append("set-cookie", clearAdminSessionCookie());
  return res;
}
