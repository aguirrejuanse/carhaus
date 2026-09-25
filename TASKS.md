# Carhaus MVP — Tasks

Checklist mirrors `sdd/carhaus/tasks` (engram). Tick items off as PRs merge; keep this in sync manually — no external task manager.

Delivery: chained PRs, stacked-to-main (each PR targets `main`).

## Work units → PRs

| Unit | Goal | PR | Depends on | Status |
|---|---|---|---|---|
| 1 | Scaffold + schema + seed (Ph.1-2) | PR1 | — | ✅ merged |
| 2 | Distance/pricing/quote libs + tests (Ph.3) | PR2 | PR1 | ✅ merged |
| 3 | API guards + auth + mutationRoute (Ph.4) | PR3 | PR1 | ✅ merged |
| 4 | Pricing preview route (Ph.5) | PR4 | PR2, PR3 | ✅ merged |
| 5 | Booking flow: `POST /api/trips` + UI (Ph.6) | PR5 | PR4 | ✅ merged |
| 6 | Admin login (Ph.7) | PR6 | PR3 | ✅ merged |
| 7 | Admin approval route + UI (Ph.8) | PR7 | PR5, PR6 | ✅ merged |
| 8 | Notifications (Ph.9) | PR8 | PR7 | ✅ merged |
| 9 | Templates (Ph.10) | PR9 | PR5 | open |
| 10 | Email OTP verification + rider login (Ph.11) | PR10 | PR9 | open |

## Phase 1: Scaffold + Tooling
- [x] 1.1 Init Next.js 15 App Router + TS + Tailwind 4, pnpm
- [x] 1.2 Install drizzle-orm, @neondatabase/serverless, zod, jose, bcrypt, nanoid, resend, shadcn
- [x] 1.3 Configure Vitest + `pnpm test` script
- [x] 1.4 `lib/env.ts` — validate `APP_ORIGIN`, `DATABASE_URL`, `JWT_SECRET`, `QUOTE_SECRET` at boot
- [x] 1.5 `shadcn init` + Field/FieldGroup/Button components

## Phase 2: Schema + DB
- [x] 2.1 `db/schema.ts` — users, admins, cars, drivers, trips, trip_legs, trip_extras, pricing_rules, notifications, trip_templates (const-object enums)
- [x] 2.2 `drizzle.config.ts` + `db/index.ts` (neon-http)
- [x] 2.3 `drizzle-kit generate` migration
- [x] 2.4 `db/seed.ts` — admin, pricing_rules row, cars, drivers

## Phase 3: Pricing/Distance/Quote Libs
- [x] 3.1 `lib/distance.ts` DistanceProvider + Google impl, `AbortSignal.timeout(5000)`; test stubbed fetch + timeout (spec: Distance Provider Failure Handling)
- [x] 3.2 `lib/pricing.ts` priceLeg/priceTrip, night multiplier via Intl, min fare; test night boundary, min fare, 2-leg sum (spec: Price Preview, 2-leg pricing)
- [x] 3.3 `lib/quote.ts` HMAC sign/verify quote token; test sign/verify/expiry

## Phase 4: API Guards + Auth
- [x] 4.1 `lib/api/guards.ts` assertSameOrigin; test missing/foreign/matching Origin
- [x] 4.2 `lib/api/errors.ts` error envelope + codes (400/401/403/409/422/502)
- [x] 4.3 `lib/api/route.ts` mutationRoute() wrapper (origin→admin?→zod→handler→errors)
- [x] 4.4 `lib/auth.ts` admin JWT sign/verify (jose) + requireAdmin(); test absent/expired/tampered
- [x] 4.5 `middleware.ts` matcher `/admin/:path*` (spec: Gated Admin Route)

## Phase 5: Pricing Preview Route
- [x] 5.1 `app/api/pricing/preview/route.ts` POST via mutationRoute (spec: Price Preview)
- [x] 5.2 Integration test: 200 quote, 502 on provider failure

## Phase 6: Booking Flow
- [x] 6.1 `app/api/trips/route.ts` POST — verify quote, upsert user by email, batch tx trips+trip_legs+trip_extras, set `carhaus_rider` cookie, publicToken (spec: Rider Trip Request, Email-Keyed Identity, Trip Extras)
- [x] 6.2 `app/_components/booking-form.tsx` — useActionState+apiFetch, debounced preview, 1/2-leg toggle
- [x] 6.3 `app/page.tsx` wiring
- [x] 6.4 `app/trips/[token]/page.tsx` confirmation page
- [x] 6.5 Integration test: 201 create, 409 bad/expired quote

## Phase 7: Admin Login
- [x] 7.1 `app/api/admin/login/route.ts` POST bcrypt+jose+HttpOnly cookie
- [x] 7.2 `app/(admin)/admin/login/page.tsx`
- [x] 7.3 Integration test: 200 valid, 401 invalid creds

## Phase 8: Admin Approval
- [x] 8.1 `app/api/admin/trips/[id]/route.ts` PATCH — requireAdmin, conditional `UPDATE...WHERE status='pending'` batch tx, assign car/driver, insert notifications row (spec: Approve with Assignment, Reject Trip, Trip Immutability)
- [x] 8.2 `app/(admin)/admin/page.tsx` pending queue (spec: Admin Review Queue)
- [x] 8.3 `app/(admin)/admin/trips/[id]/` approve/reject UI, useMutation+router.refresh
- [x] 8.4 Integration test: 200, 401, 409 double-approve

## Phase 9: Notifications
- [x] 9.1 `lib/notifications.ts` buildWhatsAppLink + Resend send; test link format, send success/fail
- [x] 9.2 Wire dispatch after PATCH commit outside tx, mark sent/failed (spec: Approval Email)
- [x] 9.3 Surface wa.me link in confirmation + admin UI (spec: WhatsApp Deep Link)

## Phase 10: Templates
- [x] 10.1 `app/api/templates/route.ts` POST+GET, rider-cookie auth (spec: Save Recurring Template, Session-Scoped Template Listing)
- [x] 10.2 UI: save-as-template button + template list, one-click re-request (spec: Re-request Template)
- [x] 10.3 Integration test: save, list scoped to cookie, re-request pre-fill

## Phase 11: Rider Email Verification (OTP)
- [x] 11.1 `verification_codes` table + migration — one active code per email, HMAC-hashed, 10 min TTL, max 5 attempts
- [x] 11.2 `lib/email.ts` shared Resend sender (refactored out of notifications) + `lib/otp.ts` request/verify with resend cooldown
- [x] 11.3 `POST /api/auth/otp` + `POST /api/auth/verify` — verify issues the `carhaus_rider` session (only issuer)
- [x] 11.4 `POST /api/trips` requires the rider session — 401 anonymous; email no longer trusted from the request body
- [x] 11.5 UI: shared `VerifyEmailForm`, booking 401 → code step → auto-resubmit, `/ingresar` page, header "Ingresar" link
- [x] 11.6 Tests: otp hash/cooldown/attempts/expiry/cross-email, routes 200/401/422/429, trips 401 anonymous + 201 verified

## Phase 12: Demo Readiness
- [x] 12.1 driver.js guided tour (`useDemoTour` + `data-tour` attrs) — auto-runs once, "¿Cómo funciona?" replays it
- [x] 12.2 `not-found.tsx` + `error.tsx` branded pages
- [x] 12.3 `metadataBase` + OpenGraph on the root layout
- [x] 12.4 `admin_login_attempts` per-IP cap on admin login
