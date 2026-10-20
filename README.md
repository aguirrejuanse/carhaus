# Carhaus

Private driver booking platform — riders quote and book trips, an admin
queue approves them. Built for a chauffeur service in Mendoza, Argentina.

## Demo

![Carhaus demo](docs/media/launch-hero.gif)

Full videos: [hero](docs/media/launch-hero-v1.mp4) ·
[product tour](docs/media/launch-tour-v1.mp4) ·
[teaser](docs/media/launch-teaser-v1.mp4) ·
[booking a ride](docs/media/reel-pedido-v1.mp4) ·
[trip detail](docs/media/reel-viaje-v1.mp4) ·
[direct booking](docs/media/reel-directo-v1.mp4)

## What it does

- **Instant price quotes** — real driving distance/duration via Google
  Distance Matrix, priced by versioned rules (base fare + per-km +
  per-minute + night multiplier). 1–2 legs (one-way / round trip).
- **Places autocomplete + signed map preview** — the rider sees resolved
  addresses and a static map of the route before booking.
- **Email OTP verification** — riders prove email ownership before a trip
  enters the admin queue. No accounts, no passwords.
- **Signed quotes** — the server signs the quote (HMAC); the booking
  endpoint verifies it instead of trusting a client-supplied price.
- **Admin queue** — approve/reject trips, assign car + driver; approval
  emails via Resend and `wa.me` deep links to the assigned driver.
- **Trip templates** — riders save frequent routes for one-tap rebooking.

## Stack

Next.js 15 (App Router, Turbopack) · React 19 · TypeScript · Drizzle ORM +
Neon Postgres · Tailwind 4 + shadcn · TanStack Query · Zod 4 · jose (JWT)
· Vitest · pnpm

## Engineering notes

- **Provider keys never reach the client** — Google Maps calls are
  proxied server-side; the static-map endpoint only serves routes it
  signed (HMAC), so it can't be used as a free maps proxy.
- **Every billable endpoint is rate-limited** — per-IP, DB-backed caps
  on previews, OTP requests, and admin login.
- **CSRF by Origin check** — `mutationRoute()` asserts same-origin on
  every mutation (Next middleware alone is bypassable, CVE-2025-29927).
- **Secrets stay hashed/signed** — OTP codes stored HMAC-hashed, admin
  sessions as HS256 JWTs, quotes tamper-evident.

## Getting started

Requires pnpm and a Postgres database (Neon works out of the box).

```bash
cp .env.example .env.local   # fill in DATABASE_URL + secrets
pnpm install
pnpm db:migrate              # apply drizzle migrations
pnpm db:seed                 # admin user + initial pricing rules
pnpm db:seed:demo            # optional: demo trips for the admin queue
pnpm dev                     # http://localhost:3000
```

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `APP_ORIGIN` | yes | Base URL of the deployment (`http://localhost:3000` locally) |
| `DATABASE_URL` | yes | Neon Postgres connection string |
| `JWT_SECRET` | yes | Signs admin session JWTs (min 32 chars) |
| `QUOTE_SECRET` | yes | Signs quote tokens + map URLs (min 32 chars) |
| `GOOGLE_MAPS_API_KEY` | yes | Distance Matrix, Places (New), Static Maps |
| `SEED_ADMIN_PASSWORD` | no | Overrides the seeded admin password |
| `RESEND_API_KEY` | no | Approval emails (trips still approve without it) |
| `RESEND_FROM` | no | Verified sender address |
| `OPERATOR_WHATSAPP_NUMBER` | no | Fallback number for `wa.me` links |

Generate secrets with `openssl rand -hex 32`.

### Local admin access

`db:seed` creates `admin@carhaus.dev` with password `changeme123!`
(or `SEED_ADMIN_PASSWORD` if set). Admin UI lives at `/admin` — sign in
via `/admin/login`.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Dev server (Turbopack) |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm test` | Vitest suite (111+ tests) |
| `pnpm lint` | ESLint |
| `pnpm db:generate` / `pnpm db:migrate` | Drizzle migrations |
| `pnpm db:seed` / `pnpm db:seed:demo` | Seed admin + rules / demo trips |
| `pnpm db:studio` | Drizzle Studio |

## Layout

```
app/api/          route handlers (mutationRoute boundary, zod-validated)
app/_hooks/       TanStack Query hooks (component → hook → service → HTTP)
db/               schema, queries, migrations, seeds
lib/              domain logic — pricing, quotes (HMAC), OTP, distance,
                  notifications, API guards/errors
```
