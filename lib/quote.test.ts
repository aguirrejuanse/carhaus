import { describe, expect, it, vi } from "vitest";
import {
  type QuotePayload,
  QuoteVerificationError,
  createQuoteExpiry,
  signQuote,
  verifyQuote,
} from "./quote";

const SECRET = "a".repeat(32);
const OTHER_SECRET = "b".repeat(32);

function buildPayload(overrides: Partial<QuotePayload> = {}): QuotePayload {
  return {
    legs: [
      {
        sequence: 1,
        origin: "Origin St 1",
        destination: "Destination Ave 2",
        scheduledAt: "2026-01-10T12:00:00.000Z",
        distanceMeters: 10_000,
        durationSeconds: 1200,
        priceCents: 2400,
      },
    ],
    totalPriceCents: 2400,
    exp: createQuoteExpiry(),
    ...overrides,
  };
}

describe("signQuote / verifyQuote", () => {
  it("round-trips a signed quote back to the original payload", () => {
    const payload = buildPayload();
    const token = signQuote(payload, SECRET);

    const verified = verifyQuote(token, SECRET);

    expect(verified).toEqual(payload);
  });

  it("rejects a token signed with a different secret", () => {
    const token = signQuote(buildPayload(), SECRET);

    expect(() => verifyQuote(token, OTHER_SECRET)).toThrow(
      QuoteVerificationError,
    );
  });

  it("rejects a token whose payload was tampered with after signing", () => {
    const token = signQuote(buildPayload(), SECRET);
    const [encodedPayload, signature] = token.split(".");

    const tamperedPayload = Buffer.from(
      JSON.stringify(buildPayload({ totalPriceCents: 1 })),
      "utf8",
    ).toString("base64url");

    expect(tamperedPayload).not.toBe(encodedPayload);

    const tamperedToken = `${tamperedPayload}.${signature}`;

    expect(() => verifyQuote(tamperedToken, SECRET)).toThrow(
      QuoteVerificationError,
    );
  });

  it("rejects a malformed token (missing signature segment)", () => {
    expect(() => verifyQuote("not-a-valid-token", SECRET)).toThrow(
      QuoteVerificationError,
    );
  });

  it("rejects an expired quote", () => {
    vi.useFakeTimers();
    const now = new Date("2026-01-10T12:00:00.000Z");
    vi.setSystemTime(now);

    const payload = buildPayload({ exp: createQuoteExpiry(now.getTime()) });
    const token = signQuote(payload, SECRET);

    // Advance past the 15-minute TTL.
    vi.setSystemTime(new Date(now.getTime() + 16 * 60 * 1000));

    expect(() => verifyQuote(token, SECRET)).toThrow(QuoteVerificationError);

    vi.useRealTimers();
  });

  it("accepts a quote right up to (but not past) its expiry", () => {
    vi.useFakeTimers();
    const now = new Date("2026-01-10T12:00:00.000Z");
    vi.setSystemTime(now);

    const payload = buildPayload({ exp: createQuoteExpiry(now.getTime()) });
    const token = signQuote(payload, SECRET);

    vi.setSystemTime(new Date(now.getTime() + 14 * 60 * 1000));

    expect(() => verifyQuote(token, SECRET)).not.toThrow();

    vi.useRealTimers();
  });
});
