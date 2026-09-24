/**
 * `POST /api/auth/verify` — checks an email OTP; on success upserts the
 * rider `users` row and sets the `carhaus_rider` session cookie (design
 * decision #7). This is the only way a rider session is issued — booking
 * without it returns `401 unauthorized` (see `POST /api/trips`).
 */

import { z } from "zod";
import { jsonSuccess } from "@/lib/api/errors";
import { mutationRoute } from "@/lib/api/route";
import { verifyEmailCode } from "@/lib/otp";
import { riderSessionCookie, signRiderSession } from "@/lib/rider";

const verifySchema = z.object({
  email: z.email(),
  code: z.string().regex(/^\d{6}$/),
});

export const POST = mutationRoute({
  schema: verifySchema,
  handler: async (input) => {
    const user = await verifyEmailCode(input.email, input.code);
    const token = await signRiderSession(user.id);
    const res = jsonSuccess({ email: user.email });
    res.headers.append("set-cookie", riderSessionCookie(token));
    return res;
  },
});
