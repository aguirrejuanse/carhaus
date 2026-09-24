# CLAUDE.md

## Deployment

Vercel: APP_ORIGIN is optional — lib/env.ts falls back to
https://$VERCEL_URL per deployment. Do NOT set APP_ORIGIN in Vercel
env vars unless a custom domain is added (a fixed value breaks
preview deploys: the same-origin check would 403 every mutation).
