/**
 * Admin session JWTs (design decision #4: "Admin auth in API routes").
 * `POST /api/admin/login` (a later PR) signs the session; `middleware.ts`
 * verifies it for `/admin/:path*` as a UX redirect gate; `requireAdmin()`
 * re-verifies it inside every `/api/admin/*` handler because middleware is
 * not the authorization boundary — `/api/admin/*` are different URLs from
 * the page routes middleware guards, and middleware has historically been
 * bypassable. `jose` is used (not a Node-only JWT lib) because it must run
 * in both the Node.js route-handler runtime and the Edge middleware runtime.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { NextRequest } from "next/server";
import { ApiError } from "./api/errors";
import { getEnv } from "./env";

export const ADMIN_COOKIE_NAME = "carhaus_admin";

const ADMIN_JWT_ALG = "HS256";
/** Admin sessions are not spec-mandated to a specific TTL; 7 days matches typical dashboard session length. */
const ADMIN_SESSION_TTL = "7d";

export interface AdminSessionPayload {
  adminId: string;
  email: string;
}

export class AdminSessionError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AdminSessionError";
  }
}

function getSigningKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().JWT_SECRET);
}

export async function signAdminSession(
  payload: AdminSessionPayload,
): Promise<string> {
  return await new SignJWT({ adminId: payload.adminId, email: payload.email })
    .setProtectedHeader({ alg: ADMIN_JWT_ALG })
    .setIssuedAt()
    .setExpirationTime(ADMIN_SESSION_TTL)
    .sign(getSigningKey());
}

/** `Set-Cookie` header value that expires the admin session immediately. */
export function clearAdminSessionCookie(): string {
  return `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}

/**
 * Verifies signature and expiry, returning the decoded payload. Throws
 * `AdminSessionError` for any absent/expired/tampered/malformed token.
 */
export async function verifyAdminSession(
  token: string,
): Promise<AdminSessionPayload> {
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, getSigningKey(), {
      algorithms: [ADMIN_JWT_ALG],
    }));
  } catch (cause) {
    throw new AdminSessionError("Invalid or expired admin session", cause);
  }

  const { adminId, email } = payload;
  if (typeof adminId !== "string" || typeof email !== "string") {
    throw new AdminSessionError("Malformed admin session payload");
  }

  return { adminId, email };
}

/**
 * Re-verifies the admin JWT inside a `/api/admin/*` handler. Used by
 * `mutationRoute({ admin: true, ... })`; throws `ApiError(401)` so it maps
 * directly to the HTTP contract instead of leaking `AdminSessionError`.
 */
export async function requireAdmin(
  req: NextRequest,
): Promise<AdminSessionPayload> {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) {
    throw new ApiError(401, "unauthorized", "Admin session required");
  }

  try {
    return await verifyAdminSession(token);
  } catch {
    throw new ApiError(401, "unauthorized", "Admin session is invalid or expired");
  }
}
