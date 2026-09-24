---
name: vercel-preview
description: Debugging playbook for Carhaus Vercel preview deploys — env var gotchas (APP_ORIGIN/VERCEL_URL fallback, masked secrets, stale DATABASE_URL), vercel curl for Deployment Protection, git-integration deploy lag, and the Google Cloud API enablement checklist. Use when a preview deploy misbehaves, envs look wrong, or a Google API 4xx/5xx's.
---

# Vercel Preview Playbook (Carhaus)

## Env vars

- **`APP_ORIGIN` must stay unset on Vercel** — `lib/env.ts` falls back to `https://${VERCEL_URL}` per deployment. A fixed value breaks the same-origin guard → every mutation 403s on previews. (Set it only if a stable custom domain exists.)
- **`vercel env pull` masks secrets** — pulled values show literal `[SENSITIVE]`. That's CLI masking, not proof of a bad value. Don't "fix" a masked value.
- **Stale envs 500 silently-ish**: `NeonDbError: password authentication failed` = `DATABASE_URL` in Vercel is old. Sync from the working `.env.local`: `vercel env rm DATABASE_URL preview` → `vercel env add DATABASE_URL preview` (repeat for production), then redeploy — envs bind at build/deploy time.
- Unknown 500s: `toErrorResponse` logs via `console.error` — check Vercel function logs, not just request metadata.

## Testing a protected preview

- Deployment Protection (SSO) blocks plain `curl` — use **`vercel curl <url>`**, which injects the bypass token.
- The branch alias `https://carhaus-git-<branch>-aguirrejuanses-projects.vercel.app` always points at the branch's latest deploy — handy when the per-commit URL changes.

## Deploy lag

Git-integration deploys can lag several minutes behind rapid pushes. If `vercel ls` shows no new deployment after a push, don't wait — `vercel deploy` builds/uploads the working tree immediately (it's HEAD when the tree is clean).

## Google Cloud checklist (billable APIs)

Two separate steps, both manual in console.cloud.google.com — doing one without the other still fails:

1. **Enable the API** in the project (API Library → e.g. `places.googleapis.com`, `maps-static-backend.googleapis.com`). Distance Matrix ≠ Static Maps ≠ Places — separate products.
2. **Add it to the API key's restriction allowlist** (Credentials → key → API restrictions). Symptom when missing: `403 API_KEY_SERVICE_BLOCKED` — project enablement alone won't fix it.

Provider quirks seen:

- Places Autocomplete (New): `locationBias.circle.radius` max **50,000 m**; Essentials SKU ~10k free req/mo; response already includes `placeId` + formatted text (no Place Details call needed).
- Distance Matrix accepts `place_id:<id>` values in `origins`/`destinations` — more precise than re-geocoding free text.
