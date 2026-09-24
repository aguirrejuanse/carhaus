/**
 * Shared HTTP error envelope for every `/api/*` route (design "HTTP
 * Contract"): success responses are `{ data }`, failures are
 * `{ error: { code, message, fields? } }`. Route handlers throw `ApiError`
 * (or let `mutationRoute()` throw one for origin/auth/validation failures)
 * and let `toErrorResponse` turn it into a `Response`.
 */

export interface ApiErrorFields {
  [field: string]: string[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: ApiErrorFields;
  };
}

export interface ApiSuccessBody<T> {
  data: T;
}

/**
 * Thrown by guards, `mutationRoute()`, and route handlers. `status` is the
 * HTTP status per the design's code table (400/401/403/409/422/502); `code`
 * is the machine-readable error code surfaced to the client.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: ApiErrorFields,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonSuccess<T>(data: T, status = 200): Response {
  return Response.json({ data } satisfies ApiSuccessBody<T>, { status });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  fields?: ApiErrorFields,
): Response {
  const body: ApiErrorBody = { error: { code, message, ...(fields ? { fields } : {}) } };
  return Response.json(body, { status });
}

/**
 * Central catch-all used by `mutationRoute()`. Known `ApiError`s map to
 * their declared status/code; anything else is an implementation bug, not
 * part of the documented contract, so it is reported as a generic 500
 * rather than leaking internals.
 */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    if (error.status >= 500) {
      console.error(`[api] ${error.code}:`, error);
    }
    return errorResponse(error.status, error.code, error.message, error.fields);
  }

  console.error("[api] unhandled error:", error);
  return errorResponse(500, "internal_error", "Unexpected server error");
}
