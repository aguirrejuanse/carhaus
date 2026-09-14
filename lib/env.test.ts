import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REQUIRED_KEYS = [
  "APP_ORIGIN",
  "DATABASE_URL",
  "JWT_SECRET",
  "QUOTE_SECRET",
  "GOOGLE_MAPS_API_KEY",
] as const;

const originalEnv: Record<string, string | undefined> = {};

describe("getEnv", () => {
  beforeEach(() => {
    for (const key of REQUIRED_KEYS) {
      originalEnv[key] = process.env[key];
    }
    process.env.APP_ORIGIN = "https://carhaus.example.com";
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/carhaus";
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.QUOTE_SECRET = "b".repeat(32);
    process.env.GOOGLE_MAPS_API_KEY = "test-google-maps-api-key";
    vi.resetModules();
  });

  afterEach(() => {
    for (const key of REQUIRED_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  it("returns parsed env when all required vars are present", async () => {
    const { getEnv } = await import("./env");
    const env = getEnv();
    expect(env.APP_ORIGIN).toBe("https://carhaus.example.com");
    expect(env.DATABASE_URL).toContain("carhaus");
  });

  it("throws when a required var is missing", async () => {
    delete process.env.JWT_SECRET;
    const { getEnv } = await import("./env");
    expect(() => getEnv()).toThrow(/Invalid environment configuration/);
  });

  it("throws when JWT_SECRET is too short", async () => {
    process.env.JWT_SECRET = "too-short";
    const { getEnv } = await import("./env");
    expect(() => getEnv()).toThrow();
  });
});
