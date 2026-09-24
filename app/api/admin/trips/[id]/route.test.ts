import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { approveTrip, getTripForAdmin, rejectTrip } from "@/db/queries";
import { signAdminSession } from "@/lib/auth";
import { dispatchTripNotification } from "@/lib/notifications";
import { PATCH } from "./route";

vi.mock("@/db/queries", () => ({
  getTripForAdmin: vi.fn(),
  approveTrip: vi.fn(),
  rejectTrip: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  dispatchTripNotification: vi.fn(async () => {}),
}));

const APP_ORIGIN = "https://carhaus.example.com";
const JWT_SECRET = "a".repeat(32);
const TRIP_ID = "b5f0c2d4-3f4a-4b5c-8d9e-1f2a3b4c5d6e";
const CAR_ID = "c5f0c2d4-3f4a-4b5c-8d9e-1f2a3b4c5d6e";
const DRIVER_ID = "d5f0c2d4-3f4a-4b5c-8d9e-1f2a3b4c5d6e";
const originalEnv: Record<string, string | undefined> = {};
const ENV_KEYS = [
  "APP_ORIGIN",
  "DATABASE_URL",
  "JWT_SECRET",
  "QUOTE_SECRET",
  "GOOGLE_MAPS_API_KEY",
] as const;

const pendingTrip = {
  id: TRIP_ID,
  status: "pending",
  user: { email: "rider@example.com" },
};

function buildCtx() {
  return { params: Promise.resolve({ id: TRIP_ID }) };
}

async function buildRequest(opts: {
  body?: unknown;
  admin?: boolean;
}): Promise<NextRequest> {
  const req = new NextRequest(`${APP_ORIGIN}/api/admin/trips/${TRIP_ID}`, {
    method: "PATCH",
    headers: new Headers({
      origin: APP_ORIGIN,
      "content-type": "application/json",
    }),
    body: JSON.stringify(opts.body ?? {}),
  });

  if (opts.admin) {
    const token = await signAdminSession({
      adminId: "admin-1",
      email: "admin@carhaus.dev",
    });
    req.cookies.set("carhaus_admin", token);
  }

  return req;
}

describe("PATCH /api/admin/trips/[id]", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
    }
    process.env.APP_ORIGIN = APP_ORIGIN;
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/carhaus";
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.QUOTE_SECRET = "b".repeat(32);
    process.env.GOOGLE_MAPS_API_KEY = "test-google-maps-api-key";

    vi.mocked(getTripForAdmin).mockResolvedValue(pendingTrip as never);
    vi.mocked(approveTrip).mockResolvedValue({
      ...pendingTrip,
      status: "approved",
    } as never);
    vi.mocked(rejectTrip).mockResolvedValue({
      ...pendingTrip,
      status: "rejected",
    } as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  it("returns 200 and approves with car/driver assignment", async () => {
    const res = await PATCH(
      await buildRequest({
        admin: true,
        body: { action: "approve", carId: CAR_ID, driverId: DRIVER_ID },
      }),
      buildCtx(),
    );

    expect(res.status).toBe(200);
    expect(approveTrip).toHaveBeenCalledWith({
      tripId: TRIP_ID,
      carId: CAR_ID,
      driverId: DRIVER_ID,
      riderEmail: "rider@example.com",
    });
    expect(dispatchTripNotification).toHaveBeenCalledWith(TRIP_ID);
  });

  it("returns 200 and rejects with a reason", async () => {
    const res = await PATCH(
      await buildRequest({
        admin: true,
        body: { action: "reject", reason: "No cars available" },
      }),
      buildCtx(),
    );

    expect(res.status).toBe(200);
    expect(dispatchTripNotification).toHaveBeenCalledWith(TRIP_ID);
    expect(rejectTrip).toHaveBeenCalledWith({
      tripId: TRIP_ID,
      reason: "No cars available",
      riderEmail: "rider@example.com",
    });
  });

  it("returns 401 without an admin session", async () => {
    const res = await PATCH(
      await buildRequest({
        body: { action: "approve", carId: CAR_ID, driverId: DRIVER_ID },
      }),
      buildCtx(),
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "unauthorized" },
    });
  });

  it("returns 409 when the trip is not pending (double-approve)", async () => {
    vi.mocked(approveTrip).mockResolvedValue(null as never);

    const res = await PATCH(
      await buildRequest({
        admin: true,
        body: { action: "approve", carId: CAR_ID, driverId: DRIVER_ID },
      }),
      buildCtx(),
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "trip_not_pending" },
    });
  });

  it("returns 404 for an unknown trip", async () => {
    vi.mocked(getTripForAdmin).mockResolvedValue(null as never);

    const res = await PATCH(
      await buildRequest({
        admin: true,
        body: { action: "reject" },
      }),
      buildCtx(),
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "trip_not_found" },
    });
  });

  it("returns 422 when approve is missing car/driver", async () => {
    const res = await PATCH(
      await buildRequest({ admin: true, body: { action: "approve" } }),
      buildCtx(),
    );

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "validation_failed" },
    });
  });
});
