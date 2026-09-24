/**
 * Gated Admin Route (spec: "Gated Admin Route"). This is a UX redirect
 * gate only, not the authorization boundary — `/api/admin/*` handlers
 * re-verify the session themselves via `requireAdmin()` (design decision
 * #4), since middleware has historically been bypassable.
 */

import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/auth";

/** Must stay reachable without a session, or an unauthenticated admin could never sign in. */
const ADMIN_LOGIN_PATH = "/admin/login";

export async function middleware(req: NextRequest): Promise<NextResponse> {
  if (req.nextUrl.pathname === ADMIN_LOGIN_PATH) {
    return NextResponse.next();
  }

  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) {
    return redirectToLogin(req);
  }

  try {
    await verifyAdminSession(token);
    return NextResponse.next();
  } catch {
    return redirectToLogin(req);
  }
}

function redirectToLogin(req: NextRequest): NextResponse {
  return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, req.url));
}

export const config = {
  matcher: ["/admin/:path*"],
};
