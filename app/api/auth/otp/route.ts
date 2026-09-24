/**
 * `POST /api/auth/otp` — issues a 6-digit email verification code (spec:
 * booking verification). Mutation → `mutationRoute` (origin → zod →
 * handler). Always an idempotent "send me a code": no enumeration concern
 * because the code goes TO the email — requesting for someone else's
 * address just spams them, which the per-email resend cooldown caps.
 */

import { z } from "zod";
import { jsonSuccess } from "@/lib/api/errors";
import { mutationRoute } from "@/lib/api/route";
import { requestEmailCode } from "@/lib/otp";

const otpSchema = z.object({
  email: z.email(),
});

export const POST = mutationRoute({
  schema: otpSchema,
  handler: async (input, req) => {
    // x-forwarded-for on Vercel; falls back absent (local dev) — the IP
    // cap simply doesn't apply without it.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    await requestEmailCode(input.email, ip);
    return jsonSuccess({ sent: true });
  },
});
