import { z } from "zod";

const envSchema = z.object({
  APP_ORIGIN: z.url(),
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32),
  QUOTE_SECRET: z.string().min(32),
  GOOGLE_MAPS_API_KEY: z.string().min(1),
  // Optional: approval emails degrade to "failed" notification rows when
  // Resend isn't configured (local dev), never blocking the approval.
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM: z.string().min(1).optional(),
  // Fallback number for the wa.me deep link when a trip has no driver
  // phone yet (design decision #6).
  OPERATOR_WHATSAPP_NUMBER: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

/**
 * Validates required environment variables at boot. Call this from a
 * server-only entry point (e.g. `db/index.ts`, `middleware.ts`) so a
 * misconfigured deployment fails fast instead of 403-ing every mutation
 * (see design decision #3: APP_ORIGIN mismatch -> 403 csrf_origin_mismatch).
 */
export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse({
    // On Vercel each deployment has its own URL; VERCEL_URL is always set
    // (build + runtime) so previews get a working APP_ORIGIN automatically.
    APP_ORIGIN:
      process.env.APP_ORIGIN ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    QUOTE_SECRET: process.env.QUOTE_SECRET,
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM: process.env.RESEND_FROM,
    OPERATOR_WHATSAPP_NUMBER: process.env.OPERATOR_WHATSAPP_NUMBER,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration: ${parsed.error.message}`,
    );
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
