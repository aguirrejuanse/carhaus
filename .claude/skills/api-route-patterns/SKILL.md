---
name: api-route-patterns
description: Carhaus conventions for any new /api/* route — mutationRoute error boundary, the {data}/{error} envelope, GET proxy guards (sec-fetch-site, HMAC, input caps), and upstream-call rules. Use when creating or reviewing API route handlers, proxies to external providers, or deciding where try/catch belongs.
---

# API Route Patterns (Carhaus)

## Overview

Every `/api/*` route follows the same contract. Don't reinvent it per route — the patterns below are load-bearing (they're the project's CSRF boundary, error contract, and provider-cost control).

## Mutation routes (non-GET)

Always wrap handlers in `mutationRoute()` from `lib/api/route.ts`:

```ts
export const POST = mutationRoute({
  schema: myZodSchema,          // parsed AFTER the guards
  admin: true,                  // only for /api/admin/* — runs requireAdmin
  handler: async (input, req, ctx) => { ... return jsonSuccess(payload); },
});
```

`mutationRoute` performs, in order: `assertSameOrigin` → optional `requireAdmin` → zod parse → handler → `toErrorResponse`. **It is the error boundary.**

### The try/catch rule

> Catch only when it changes the status or code of the response.

- Domain error → contract status: catch and rethrow as `ApiError` (e.g. `verifyQuote` → `409 quote_invalid`, `DistanceProviderError` → `502 distance_provider_unavailable`).
- Everything else (DB, jose, env, unexpected): let it bubble — `toErrorResponse` logs via `console.error` and returns generic `500 internal_error` without leaking internals.
- Never write per-line try/catch, and never return `error.message` of an unknown error to the client.

### Envelope

- Success: `jsonSuccess(payload)` → `{ data }`
- Errors: `ApiError(status, code, message, fields?)` → `{ error: { code, message, fields? } }`
- `fields` maps 422 issues back onto form inputs — use `lib/api/schemas.ts` shared zod blocks instead of redeclaring shapes per route.

## GET routes / external-API proxies

`assertSameOrigin` does NOT work for GET — browsers don't send `Origin` on same-origin GETs. Choose the guard by input type:

| Input | Guard | Example |
|---|---|---|
| Server-known values | HMAC signature (`signMapParams`/`verifyMapParams` with `QUOTE_SECRET`) | `/api/map/static` |
| Free user input | `sec-fetch-site` ∈ {`same-origin`, `same-site`, `none`} + length caps | `/api/places/autocomplete` |

Proxy rules:

- **Keys stay server-side** — never put a provider key in a client-visible URL or response.
- `AbortSignal.timeout(5000)` on every upstream fetch.
- Map upstream failure → `502 <provider>_unavailable`; the client degrades gracefully (autocomplete → free text, map → self-hiding img). Provider failure is never a hard crash.
- Cache headers where safe (`cache-control: public, max-age=…` for immutable responses like the map).
- Billable upstreams need client-side discipline too: debounce, min-length, abort in-flight requests (see `place-input.tsx`).

## Route-context (`ctx`) note

`mutationRoute` returns `(req, ctx?) => Promise<Response>` — `ctx` is optional because unit tests call handlers without a route context. Dynamic routes (`[id]`) receive `{ params: Promise<…> }` typed via `TCtx`.
