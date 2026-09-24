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
  handler: async (input) => {
    await requestEmailCode(input.email);
    return jsonSuccess({ sent: true });
  },
});
