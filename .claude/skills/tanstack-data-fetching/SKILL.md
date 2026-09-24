---
name: tanstack-data-fetching
description: Carhaus client data convention — component → hook → service → HTTP with TanStack Query. Folder-per-hook in app/_hooks/, services in lib/services/ as the only layer knowing the HTTP contract, retry:false on side-effecting mutations, hidden-input pattern for non-textual form data. Use when adding any client query/mutation, form, or service call.
---

# TanStack Data Fetching (Carhaus)

## Overview

Components never call `fetch` and never own HTTP details. The chain is fixed:

```
component → app/_hooks/use-*/ → lib/services/* → apiFetch → /api/*
```

`lib/services/*` is the ONLY layer that knows the HTTP contract (paths, envelope, methods). This is the seam for a future backend migration (e.g. Nest) — services change, hooks/components don't.

## Rules

### Mutations

- TanStack `useMutation` for every POST/PATCH. **`retry: false` is deliberate** — a silent retry can double-book, double-charge, or double-notify. Never enable retries on side-effecting mutations.
- Request state (`isPending`/`isError`/`data`) comes from the mutation object — don't hand-roll `useState` status flags or `cancelled` refs.
- 422 `fields` errors: catch `ApiError` from `lib/api-client` and map `error.fields` onto inputs.

### Hooks

- One folder per hook in `app/_hooks/use-<name>/` (`use-<name>.ts` + `index.ts` barrel).
- Orchestrator hooks (like `useBookingForm`) compose mutations and own only UI state (toggles, debounce timers, validation messages).

### Forms

- Forms stay uncontrolled and FormData-driven (`new FormData(form)` on submit/change).
- Non-textual data travels via hidden inputs — e.g. a picked `place_id` lives in `<input type="hidden" name="originPlaceId">`, set on autocomplete `item-press`, cleared on typing. No extra React state plumbing for submit-time data.
- Inline option arrays in JSX go to module constants (`TRIP_MODE_OPTIONS`, `SNACK_OPTIONS`).

### Queries

- `useQuery` for reads; pass server-rendered data as `initialData` when the page already fetched it (avoids a client round-trip). Invalidate by stable keys (`["templates"]`).

### Services

- `apiFetch(path, { method, body, signal })` unwraps `{data}` / rethrows typed `ApiError`. Pass `signal` for abortable requests (autocomplete aborts the in-flight call on each keystroke).
