/**
 * Rider session cookie (design decision #7: "Rider identity"). On a
 * successful `POST /api/trips` the server sets an HttpOnly signed cookie
 * `carhaus_rider` carrying the rider's `userId` for 30 days — this is the
 * "active booking session" that `GET /api/templates` scopes template
 * listing to. No password or login exists for riders in the MVP.
 *
 * Signed with `jose` HS256 like the admin session (`lib/auth.ts`), keyed
 * by `JWT_SECRET`.
 */

import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "./env";

export const RIDER_COOKIE_NAME = "carhaus_rider";
/** 30 days, per design decision #7. */
export const RIDER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

const RIDER_JWT_ALG = "HS256";

function getSigningKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().JWT_SECRET);
}

export async function signRiderSession(userId: string): Promise<string> {
  return await new SignJWT({ userId })
    .setProtectedHeader({ alg: RIDER_JWT_ALG })
    .setIssuedAt()
    .setExpirationTime(`${RIDER_SESSION_TTL_SECONDS}s`)
    .sign(getSigningKey());
}

/** `Set-Cookie` header value for the signed rider session. */
export function riderSessionCookie(token: string): string {
  return `${RIDER_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${RIDER_SESSION_TTL_SECONDS}${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}

/**
 * Returns the rider's `userId` for a valid cookie value, or `null` for any
 * absent/expired/tampered/malformed token. Not finding a session is a
 * normal state (first-time rider), not an error — callers treat `null` as
 * "anonymous", never as 401.
 */
export async function verifyRiderSession(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSigningKey(), {
      algorithms: [RIDER_JWT_ALG],
    });
    return typeof payload.userId === "string" ? payload.userId : null;
  } catch {
    return null;
  }
}
