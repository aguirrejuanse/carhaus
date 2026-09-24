import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPendingEmailNotification,
  getTripForAdmin,
  markNotificationFailed,
  markNotificationSent,
} from "@/db/queries";
import {
  buildWhatsAppLink,
  dispatchTripNotification,
  tripWhatsAppMessage,
  whatsAppLinkForTrip,
} from "./notifications";

const sendMock = vi.hoisted(() => vi.fn());

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

// getEnv() caches at module level — mock it to read live process.env so
// tests can add/remove the optional RESEND_/OPERATOR_ vars between cases.
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    APP_ORIGIN: process.env.APP_ORIGIN,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    QUOTE_SECRET: process.env.QUOTE_SECRET,
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM: process.env.RESEND_FROM,
    OPERATOR_WHATSAPP_NUMBER: process.env.OPERATOR_WHATSAPP_NUMBER,
  }),
}));

vi.mock("@/db/queries", () => ({
  getPendingEmailNotification: vi.fn(),
  getTripForAdmin: vi.fn(),
  markNotificationSent: vi.fn(async () => {}),
  markNotificationFailed: vi.fn(async () => {}),
}));

const originalEnv: Record<string, string | undefined> = {};
const ENV_KEYS = [
  "APP_ORIGIN",
  "DATABASE_URL",
  "JWT_SECRET",
  "QUOTE_SECRET",
  "GOOGLE_MAPS_API_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM",
  "OPERATOR_WHATSAPP_NUMBER",
] as const;

const trip = {
  status: "approved",
  rejectionReason: null,
  totalPriceCents: 940000,
  legs: [
    {
      sequence: 1,
      origin: "Guaymallén",
      destination: "Plaza Shopping",
      scheduledAt: new Date("2026-10-01T15:00:00.000Z"),
    },
  ],
  assignedDriver: { name: "Pablo", phone: "+54 9 261 555-1234" },
  assignedCar: { make: "Toyota", model: "Corolla", plate: "AB123CD" },
};

describe("buildWhatsAppLink", () => {
  it("builds a wa.me link with digits-only phone and encoded text", () => {
    const link = buildWhatsAppLink("+54 9 261 555-1234", "Hola, tu viaje!");
    expect(link).toBe("https://wa.me/5492615551234?text=Hola%2C%20tu%20viaje!");
  });
});

describe("whatsAppLinkForTrip", () => {
  beforeEach(() => setBaseEnv());
  afterEach(restoreEnv);

  it("prefers the assigned driver's phone", () => {
    process.env.OPERATOR_WHATSAPP_NUMBER = "5491111111111";
    const link = whatsAppLinkForTrip(trip);
    expect(link).toContain("wa.me/5492615551234");
    expect(link).toContain(encodeURIComponent("Guaymallén → Plaza Shopping"));
  });

  it("falls back to OPERATOR_WHATSAPP_NUMBER", () => {
    process.env.OPERATOR_WHATSAPP_NUMBER = "5491111111111";
    const link = whatsAppLinkForTrip({ ...trip, assignedDriver: null });
    expect(link).toContain("wa.me/5491111111111");
  });

  it("returns null when no phone is available", () => {
    delete process.env.OPERATOR_WHATSAPP_NUMBER;
    expect(whatsAppLinkForTrip({ ...trip, assignedDriver: null })).toBeNull();
  });
});

describe("dispatchTripNotification", () => {
  beforeEach(() => {
    setBaseEnv();
    process.env.RESEND_API_KEY = "test-resend-key";
    vi.mocked(getPendingEmailNotification).mockResolvedValue({
      id: "notif-1",
      recipient: "rider@example.com",
    } as never);
    vi.mocked(getTripForAdmin).mockResolvedValue(trip as never);
    sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
    restoreEnv();
  });

  it("sends the approval email and marks the notification sent", async () => {
    await dispatchTripNotification("trip-1");

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "rider@example.com",
        subject: expect.stringContaining("confirmado"),
      }),
    );
    expect(markNotificationSent).toHaveBeenCalledWith("notif-1");
  });

  it("marks the notification failed when Resend rejects", async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    await dispatchTripNotification("trip-1");

    expect(markNotificationFailed).toHaveBeenCalledWith("notif-1", "boom");
    expect(markNotificationSent).not.toHaveBeenCalled();
  });

  it("marks the notification failed when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;

    await dispatchTripNotification("trip-1");

    expect(markNotificationFailed).toHaveBeenCalledWith(
      "notif-1",
      expect.stringContaining("RESEND_API_KEY"),
    );
  });

  it("sends the rejection email when the trip was rejected", async () => {
    vi.mocked(getTripForAdmin).mockResolvedValue({
      ...trip,
      status: "rejected",
      rejectionReason: "Sin disponibilidad",
      assignedDriver: null,
      assignedCar: null,
    } as never);

    await dispatchTripNotification("trip-1");

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("No pudimos tomar"),
        html: expect.stringContaining("Sin disponibilidad"),
      }),
    );
    expect(markNotificationSent).toHaveBeenCalledWith("notif-1");
  });

  it("does nothing when no pending notification exists", async () => {
    vi.mocked(getPendingEmailNotification).mockResolvedValue(null as never);

    await dispatchTripNotification("trip-1");

    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe("tripWhatsAppMessage", () => {
  it("includes route context", () => {
    expect(tripWhatsAppMessage(trip)).toContain("Guaymallén → Plaza Shopping");
  });
});

function setBaseEnv() {
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
  }
  process.env.APP_ORIGIN = "https://carhaus.example.com";
  process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/carhaus";
  process.env.JWT_SECRET = "a".repeat(32);
  process.env.QUOTE_SECRET = "b".repeat(32);
  process.env.GOOGLE_MAPS_API_KEY = "test-google-maps-api-key";
  delete process.env.OPERATOR_WHATSAPP_NUMBER;
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
}
