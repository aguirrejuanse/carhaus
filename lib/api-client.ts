/**
 * Client convention for calling `/api/*` route handlers (design "Client
 * Convention"). Unwraps the `{ data }` success envelope and rethrows the
 * `{ error: { code, message, fields? } }` envelope as a typed `ApiError` so
 * forms can map 422 field errors back onto inputs.
 *
 * Client-safe: `lib/api/errors.ts` has no server-only imports.
 */

import { ApiError, type ApiErrorBody, type ApiSuccessBody } from "./api/errors";

export async function apiFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    signal: opts.signal,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  const json: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const error = (json as ApiErrorBody | null)?.error;
    throw new ApiError(
      res.status,
      error?.code ?? "unknown_error",
      error?.message ?? `Request failed with status ${res.status}`,
      error?.fields,
    );
  }

  return (json as ApiSuccessBody<T>).data;
}
