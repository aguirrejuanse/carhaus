import { describe, expect, it } from "vitest";
import { ApiError, jsonSuccess, toErrorResponse } from "./errors";

describe("jsonSuccess", () => {
  it("wraps data in a { data } envelope", async () => {
    const res = jsonSuccess({ publicToken: "abc" }, 201);
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ data: { publicToken: "abc" } });
  });
});

describe("toErrorResponse", () => {
  it("maps an ApiError to its declared status/code/message/fields", async () => {
    const error = new ApiError(422, "validation_failed", "Bad input", {
      email: ["Invalid email"],
    });

    const res = toErrorResponse(error);

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({
      error: {
        code: "validation_failed",
        message: "Bad input",
        fields: { email: ["Invalid email"] },
      },
    });
  });

  it("maps an unknown error to a generic 500 without leaking internals", async () => {
    const res = toErrorResponse(new Error("some internal detail"));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: { code: "internal_error", message: "Unexpected server error" },
    });
  });
});
