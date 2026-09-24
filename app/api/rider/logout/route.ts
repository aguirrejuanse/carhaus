/**
 * `POST /api/rider/logout` — clears the `carhaus_rider` session cookie.
 * No body: same-origin guard only (there is no payload to validate).
 */

import { jsonSuccess, toErrorResponse } from "@/lib/api/errors";
import { assertSameOrigin } from "@/lib/api/guards";
import { clearRiderSessionCookie } from "@/lib/rider";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(req);
  } catch (error) {
    return toErrorResponse(error);
  }

  const res = jsonSuccess({ ok: true });
  res.headers.append("set-cookie", clearRiderSessionCookie());
  return res;
}
