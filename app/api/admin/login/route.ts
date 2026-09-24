/**
 * `POST /api/admin/login` (design decision #4: "Admin auth in API
 * routes"). bcrypt-compares the password, signs an HS256 session JWT with
 * `jose`, and sets the `carhaus_admin` HttpOnly/SameSite=Lax cookie that
 * `middleware.ts` (UX gate) and `requireAdmin()` (authorization boundary
 * in every `/api/admin/*` handler) both verify.
 *
 * Unknown email and wrong password return the same `401
 * invalid_credentials` — no account enumeration.
 */

import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  countRecentAdminLoginAttempts,
  getAdminByEmail,
  recordAdminLoginAttempt,
} from "@/db/queries";
import { ApiError, jsonSuccess } from "@/lib/api/errors";
import { mutationRoute } from "@/lib/api/route";
import { ADMIN_COOKIE_NAME, signAdminSession } from "@/lib/auth";

// bcryptjs is pure JS, but the session contract pins this route to the
// Node.js runtime (design decision #4) — same runtime as the other
// mutation handlers.
export const runtime = "nodejs";

/** Session length mirrors the JWT TTL in `lib/auth.ts` (7 days). */
const ADMIN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

/** Brute-force cap — per source IP, same pattern as the OTP cap. */
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

export const POST = mutationRoute({
  schema: loginSchema,
  handler: async (input, req) => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (
      ip &&
      (await countRecentAdminLoginAttempts(ip, LOGIN_WINDOW_MS)) >=
        LOGIN_MAX_ATTEMPTS
    ) {
      throw new ApiError(
        429,
        "login_rate_limited",
        "Demasiados intentos — probá más tarde",
      );
    }
    if (ip) await recordAdminLoginAttempt(ip);

    const admin = await getAdminByEmail(input.email);
    const passwordOk =
      admin !== null &&
      (await bcrypt.compare(input.password, admin.passwordHash));

    if (!admin || !passwordOk) {
      throw new ApiError(401, "invalid_credentials", "Invalid email or password");
    }

    const token = await signAdminSession({
      adminId: admin.id,
      email: admin.email,
    });

    const res = jsonSuccess({ email: admin.email });
    res.headers.append(
      "set-cookie",
      `${ADMIN_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ADMIN_COOKIE_MAX_AGE_SECONDS}${
        process.env.NODE_ENV === "production" ? "; Secure" : ""
      }`,
    );
    return res;
  },
});
