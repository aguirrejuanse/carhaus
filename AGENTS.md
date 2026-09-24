# Carhaus — Agent Guide

Private-transport MVP. Next.js 15 App Router, React 19, TypeScript, Tailwind 4,
Drizzle ORM + Neon Postgres, Zod 4, Vitest, jose, Resend, pnpm.

## Golden rules

- KISS and DRY, always. The simplest solution that satisfies the spec wins.
- Every mutation is a Route Handler under `app/api/*` — never Server Actions
  for persistence. This keeps the API boundary extractable to a standalone
  backend later.
- Every mutation goes through `mutationRoute()` (`lib/api/route.ts`):
  same-origin check → optional admin auth → Zod validation → handler →
  centralized error mapping. Don't reimplement per route.
- Green before merge: `pnpm test && pnpm lint && pnpm build` must pass before
  every PR.

## Architecture invariants

- `assertSameOrigin()` (`lib/api/guards.ts`) requires `Origin === APP_ORIGIN`
  on every mutation.
- Admin auth: HS256 JWT in `carhaus_admin` cookie, 7-day TTL (`lib/auth.ts`).
  Handlers verify with `requireAdmin()` — `middleware.ts` is a UX gate only,
  never the security boundary.
- Rider identity is email-keyed, no accounts: HS256 JWT in `carhaus_rider`
  cookie, 30-day TTL (`lib/rider.ts`).
- Price quotes are HMAC-SHA256 signed tokens, 15-min TTL (`lib/quote.ts`);
  `POST /api/trips` re-verifies the signed preview instead of trusting
  client-sent prices.
- Money is integer cents, distance is meters, duration is seconds.
- `pricing_rules` has no unique key — the newest `updatedAt` row is active.
- Trip writes use `db.batch()` (Neon HTTP driver) — no interactive
  transactions.
- Approved trips are immutable. Notifications dispatch after the approval
  commit, outside the DB write; failures degrade to `failed` rows.
- API envelope: `{ data: ... }` on success, error envelope via `ApiError`
  (`lib/api/errors.ts`).

## Conventions

- Enums are const objects + union types in `db/schema.ts`
  (e.g. `TRIP_TYPE` / `TripType`) — no TS enums.
- Server-only code lives in `lib/` and `db/`; client components use
  `"use client"` and call mutations via `apiFetch` (`lib/api-client.ts`).
- Route tests sit next to the route (`route.test.ts`) and stub external
  providers (Google Distance Matrix via `fetch`, `Resend` via class mock).
- `getEnv()` caches the parsed env — tests that mutate env vars mock
  `@/lib/env`.
- UI copy is Spanish. Brand: editorial-minimal — `#FAFAFA` background,
  `#1E1B4B` navy primary, `#F5C518` yellow accent used sparingly, 1px
  borders, no shadows/gradients, Outfit for headings + Work Sans for body.

## Workflow

- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`); no AI
  attribution, no `Co-Authored-By`.
- PRs follow `.claude/skills/pr/SKILL.md`: stacked-to-main — every PR
  targets `main`, merged in numeric order. Body template: Task / Overview /
  Visual Doc / Tests / Non-code changes.
- `TASKS.md` is the task tracker — tick items in the same push as the work.
  No GitHub Issues or project board.
- Never commit `.env.local`, `.atl/`, `logo.jpg`, `.vercel/`.

## Deployment (Vercel)

- `APP_ORIGIN` is optional — `lib/env.ts` falls back to
  `https://$VERCEL_URL` per deployment. Do NOT set `APP_ORIGIN` in Vercel
  env vars unless a custom domain is added: a fixed value breaks preview
  deploys (the same-origin check would 403 every mutation).
- `lib/env.ts` validates during `next build` ("Collecting page data") — a
  bad env var fails the entire deployment, not just the importing route.
