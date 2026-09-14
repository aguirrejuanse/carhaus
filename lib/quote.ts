/**
 * HMAC-signed price-preview quote tokens (design decision #5: "Quote
 * integrity"). `POST /api/pricing/preview` signs a quote; `POST /api/trips`
 * verifies the signature instead of trusting a client-supplied price or
 * recomputing (which would double the Google Distance Matrix calls).
 *
 * Token shape: `<base64url(payload json)>.<base64url(hmac-sha256)>`.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** Quote validity window, per design decision #5 ("exp: +15min"). */
export const QUOTE_TTL_MS = 15 * 60 * 1000;

export interface QuoteLeg {
  sequence: 1 | 2;
  origin: string;
  destination: string;
  /** ISO 8601 timestamp. */
  scheduledAt: string;
  distanceMeters: number;
  durationSeconds: number;
  priceCents: number;
}

export interface QuotePayload {
  legs: QuoteLeg[];
  totalPriceCents: number;
  /** Unix epoch milliseconds. */
  exp: number;
}

export class QuoteVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuoteVerificationError";
  }
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

function computeSignature(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

/** Convenience helper for callers building a payload: `exp: now + QUOTE_TTL_MS`. */
export function createQuoteExpiry(now: number = Date.now()): number {
  return now + QUOTE_TTL_MS;
}

export function signQuote(payload: QuotePayload, secret: string): string {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = computeSignature(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies signature and expiry, returning the decoded payload. Throws
 * `QuoteVerificationError` for any malformed, tampered, or expired token —
 * callers (the trips route) map this to `409 quote_invalid` / recompute.
 */
export function verifyQuote(token: string, secret: string): QuotePayload {
  const parts = token.split(".");
  if (parts.length !== 2) {
    throw new QuoteVerificationError("Malformed quote token");
  }
  const [encodedPayload, signature] = parts;

  const expectedSignature = computeSignature(encodedPayload, secret);

  const providedSignatureBuffer = base64UrlDecode(signature);
  const expectedSignatureBuffer = base64UrlDecode(expectedSignature);

  const signatureValid =
    providedSignatureBuffer.length === expectedSignatureBuffer.length &&
    timingSafeEqual(providedSignatureBuffer, expectedSignatureBuffer);

  if (!signatureValid) {
    throw new QuoteVerificationError("Invalid quote signature");
  }

  let payload: QuotePayload;
  try {
    payload = JSON.parse(
      base64UrlDecode(encodedPayload).toString("utf8"),
    ) as QuotePayload;
  } catch {
    throw new QuoteVerificationError("Malformed quote payload");
  }

  if (typeof payload.exp !== "number" || Date.now() > payload.exp) {
    throw new QuoteVerificationError("Quote has expired");
  }

  return payload;
}
