import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  row: null as null | {
    id: string;
    email: string;
    codeHash: string;
    attempts: number;
    expiresAt: Date;
    createdAt: Date;
  },
}));

const recentByIp = vi.hoisted(() => ({ count: 0 }));

vi.mock("@/db/queries", () => ({
  getLatestVerificationCode: vi.fn(async () => store.row),
  countRecentVerificationRequests: vi.fn(async () => recentByIp.count),
  replaceVerificationCode: vi.fn(async (input: {
    email: string;
    codeHash: string;
    requestIp?: string;
    expiresAt: Date;
  }) => {
    store.row = {
      id: "vc-1",
      email: input.email,
      codeHash: input.codeHash,
      attempts: 0,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
    };
    return store.row;
  }),
  bumpVerificationAttempts: vi.fn(async () => {
    if (store.row) store.row.attempts += 1;
  }),
  deleteVerificationCode: vi.fn(async () => {
    store.row = null;
  }),
  upsertUserByEmail: vi.fn(async (email: string) => ({
    id: "user-1",
    email,
  })),
}));

const sendEmail = vi.hoisted(() =>
  vi.fn<
    (
      input: {
        to: string;
        subject: string;
        text: string;
        html?: string;
      },
      options?: { idempotencyKey?: string },
    ) => Promise<void>
  >(async () => {}),
);
vi.mock("@/lib/email", () => ({
  sendEmail,
  brandedEmailHtml: (opts: { body: string }) => `<html>${opts.body}</html>`,
  logoAttachment: () => null,
  logoAttachments: () => undefined,
}));

import { ApiError } from "./api/errors";
import { requestEmailCode, verifyEmailCode } from "./otp";

const EMAIL = "rider@example.com";
const JWT_SECRET = "a".repeat(32);
const originalEnv: Record<string, string | undefined> = {};
const ENV_KEYS = [
  "APP_ORIGIN",
  "DATABASE_URL",
  "JWT_SECRET",
  "QUOTE_SECRET",
  "GOOGLE_MAPS_API_KEY",
  "RESEND_API_KEY",
] as const;

function codeHash(email: string, code: string): string {
  return createHmac("sha256", JWT_SECRET)
    .update(`${email}:${code}`)
    .digest("hex");
}

/** Extracts the 6-digit code sent in the last email body. */
function sentCode(): string {
  const html = sendEmail.mock.lastCall?.[0].html as string;
  return html.match(/>(\d{6})</)![1];
}

describe("lib/otp", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
    }
    process.env.APP_ORIGIN = "https://carhaus.example.com";
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/carhaus";
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.QUOTE_SECRET = "b".repeat(32);
    process.env.GOOGLE_MAPS_API_KEY = "test-google-maps-api-key";
    process.env.RESEND_API_KEY = "re_test";
    store.row = null;
    recentByIp.count = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  it("sends a 6-digit code and stores only its hash", async () => {
    await requestEmailCode(EMAIL);

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: EMAIL, subject: expect.stringMatching(/\d{6}/) }),
      expect.objectContaining({ idempotencyKey: expect.stringMatching(/^otp\//) }),
    );
    const code = sentCode();
    expect(store.row?.codeHash).toBe(codeHash(EMAIL, code));
    expect(store.row?.codeHash).not.toContain(code);
  });

  it("caps requests per IP to stop spraying codes at many emails", async () => {
    recentByIp.count = 20;

    await expect(
      requestEmailCode(EMAIL, "1.2.3.4"),
    ).rejects.toMatchObject({ status: 429, code: "otp_ip_limited" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rate-limits repeat requests inside the cooldown", async () => {
    await requestEmailCode(EMAIL);

    await expect(requestEmailCode(EMAIL)).rejects.toMatchObject({
      status: 429,
      code: "otp_cooldown",
    });
  });

  it("verifies the right code, consumes it, and returns the user", async () => {
    await requestEmailCode(EMAIL);
    const code = sentCode();

    const user = await verifyEmailCode(EMAIL, code);

    expect(user).toEqual({ id: "user-1", email: EMAIL });
    expect(store.row).toBeNull();
  });

  it("rejects a wrong code and bumps attempts", async () => {
    await requestEmailCode(EMAIL);
    const wrong = sentCode() === "999999" ? "000000" : "999999";

    await expect(verifyEmailCode(EMAIL, wrong)).rejects.toMatchObject({
      status: 401,
      code: "otp_invalid",
    });
    expect(store.row?.attempts).toBe(1);
    expect(store.row).not.toBeNull();
  });

  it("locks after 5 attempts even with the right code", async () => {
    await requestEmailCode(EMAIL);
    const code = sentCode();
    store.row!.attempts = 5;

    await expect(verifyEmailCode(EMAIL, code)).rejects.toMatchObject({
      status: 429,
      code: "otp_locked",
    });
  });

  it("rejects an expired code", async () => {
    await requestEmailCode(EMAIL);
    store.row!.expiresAt = new Date(Date.now() - 1000);

    await expect(verifyEmailCode(EMAIL, "123456")).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it("rejects a code minted for a different email", async () => {
    await requestEmailCode(EMAIL);
    const code = sentCode();

    await expect(
      verifyEmailCode("other@example.com", code),
    ).rejects.toMatchObject({ status: 401 });
  });
});
