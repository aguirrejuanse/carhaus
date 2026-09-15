/**
 * Shared mutation boundary for every non-GET `/api/*` handler (design
 * decision #2/#3/#4). Order is fixed and non-negotiable: same-origin check
 * -> admin check (when required) -> zod validation -> handler -> error
 * mapping. Individual routes only supply a schema and a handler; they never
 * re-implement origin/auth/validation checks themselves.
 */

import type { NextRequest } from "next/server";
import type { ZodType } from "zod";
import { requireAdmin } from "@/lib/auth";
import { ApiError, toErrorResponse } from "./errors";
import { assertSameOrigin } from "./guards";

export interface MutationRouteOptions<TBody, TCtx> {
  schema: ZodType<TBody>;
  /** When true, requires a valid admin session (`requireAdmin`) before validation. */
  admin?: boolean;
  handler: (input: TBody, req: NextRequest, ctx: TCtx) => Promise<Response>;
}

export function mutationRoute<TBody, TCtx = unknown>(
  opts: MutationRouteOptions<TBody, TCtx>,
): (req: NextRequest, ctx: TCtx) => Promise<Response> {
  return async (req, ctx) => {
    try {
      assertSameOrigin(req);

      if (opts.admin) {
        await requireAdmin(req);
      }

      const input = await parseBody(req, opts.schema);

      return await opts.handler(input, req, ctx);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

async function parseBody<TBody>(
  req: NextRequest,
  schema: ZodType<TBody>,
): Promise<TBody> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON");
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    const fields: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "_root";
      fields[key] = [...(fields[key] ?? []), issue.message];
    }
    throw new ApiError(
      422,
      "validation_failed",
      "Request body failed validation",
      fields,
    );
  }

  return result.data;
}
