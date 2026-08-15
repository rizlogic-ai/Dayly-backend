# Dayly Backend

Node.js/Express API for the Dayly app: Firebase-verified authentication,
user preferences, activities + completion events, and a grocery list.

Mirrors the Flutter client's own domain model (see
`dayly-app/ARCHITECTURE.md`) rather than inventing a second one —
`recurrence_rule` and `tracking_spec` are stored as the same JSON shapes
the client already produces, so this backend doesn't need to understand
Dayly's sealed-hierarchy domain logic, only persist and scope it per user.

## Stack

- **Express** — HTTP layer, plain routers, no framework beyond that.
- **PostgreSQL** (`pg`) — raw parameterized SQL, no ORM. Everything lives
  under a dedicated `dayly` schema (not `public`), so this can share a
  Postgres instance/database with other projects without table-name
  collisions.
- **Firebase Admin SDK** — verifies ID tokens the client already got from
  Firebase Auth. There is no password anywhere in this codebase; the
  first authenticated request from a new Firebase UID *is* the signup
  (see `src/middleware/authenticate.js`).

## Project layout

```
src/
  config/        env loading, Postgres pool, Firebase Admin init
  db/            schema.sql (idempotent, IF NOT EXISTS everywhere) + migrate.js
  middleware/    authenticate (Firebase verify + user upsert), error handling
  repositories/  parameterized SQL, one file per table, every query scoped by user_id
  routes/        Express routers — thin, delegate straight to repositories
  app.js         Express app wiring
  index.js       server entrypoint
```

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` — a Postgres connection string. Locally this machine
     already runs Postgres on `localhost:5433`; point at a dedicated
     `dayly` **database** there (the `dayly` **schema** inside it is
     created automatically by the migration, distinct from the database
     name — you can call the database anything).
   - Firebase Admin credentials — from Firebase Console → Project
     Settings → Service Accounts → Generate new private key. See
     `.env.example` for the two supported formats (a single
     `FIREBASE_SERVICE_ACCOUNT_BASE64`, preferred, or three discrete
     `FIREBASE_*` vars for quicker local hand-editing).
3. `npm run migrate` — applies `src/db/schema.sql`. Safe to re-run any
   time; every statement is `IF NOT EXISTS`.
4. `npm run dev` (hot-reload via nodemon) or `npm start`.

## Deploying (e.g. Render)

- Build command: `npm install`
- Start command: `npm start`
- Run `npm run migrate` once (Render's shell, or a one-off job) against
  the same `DATABASE_URL` the web service uses, before or after first
  deploy — it's idempotent either way.
- Set `DATABASE_URL` and **`FIREBASE_SERVICE_ACCOUNT_BASE64`** (not the
  three discrete `FIREBASE_*` vars) in the service's environment
  settings. This is not optional on Render specifically — its env var
  editor doesn't reliably preserve a literal multi-line PEM key through
  the `\n`-escaped-single-line convention the discrete vars need, which
  surfaced as a real boot crash (`ERR_OSSL_UNSUPPORTED`, "Failed to
  parse private key"). Base64 has no newlines or quotes for any
  platform's editor to mangle.
- SSL is auto-detected (on for any non-localhost `DATABASE_URL`, which
  covers Render Postgres) — no extra env var needed unless you want to
  force it either way with `PGSSL=true`/`false`. See `src/config/env.js`.

## Hardening

- **CORS** — open to any origin by default (fine while every client is
  the mobile app authenticating with a Bearer header, not a cookie). Set
  `CORS_ORIGIN` (comma-separated for more than one) once a browser-based
  client exists and you know its origin(s).
- **Rate limiting** — a single ceiling of 300 requests / 15 min per IP
  across all of `/api` (`src/app.js`), meant as a "stop a runaway or
  malicious client" backstop, not a product-shaped per-endpoint limit.
  `/health` is excluded so uptime checks never compete with it.
- **`helmet()`** — standard security headers, no configuration needed.
- Every request logs one line (method, path, status, duration) via
  `src/middleware/requestLogger.js` — deliberately not a logging library,
  this is the whole need for a service this size.

## Auth flow

1. Client signs in with Firebase Auth (any provider) and gets an ID token.
2. Every request sends `Authorization: Bearer <idToken>`.
3. `authenticate` middleware verifies it via `firebase-admin`, then
   upserts a row in `dayly.users` keyed by the Firebase UID — this *is*
   the login table; there's no separate register endpoint.
4. `POST /api/auth/session` is a convenience the client calls right after
   sign-in to fetch `{ user, preferences }` in one round trip (creating
   default preferences on first login).

Every other route requires the same header and only ever reads/writes
rows where `user_id` matches the authenticated user — see the ownership
checks in `src/repositories/activities.repository.js` and
`events.repository.js` for how cross-user access is blocked at the query
level, not just the route level.

## API

All routes below except `/health` require `Authorization: Bearer <idToken>`.

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Unauthenticated liveness check |
| POST | `/api/auth/session` | Verify token, upsert user, return `{ user, preferences }` |
| GET | `/api/preferences` | Onboarding state, enabled modules, home location, prayer params |
| PUT | `/api/preferences` | Partial update — send only changed fields |
| GET | `/api/activities?includeArchived=true` | List activities (active only by default) |
| GET | `/api/activities/:id` | One activity |
| POST | `/api/activities` | Create (`title`, `moduleType`, `recurrenceRule` required; `id` optional — server generates one if omitted) |
| PUT | `/api/activities/:id` | Full save-in-place, same semantics as the client's own `save()` |
| POST | `/api/activities/:id/archive` | Archive, never delete — history stays queryable |
| POST | `/api/activities/:id/restore` | Un-archive |
| GET | `/api/activities/:id/events` | Completion events for one activity |
| POST | `/api/activities/:id/events` | Append a completion event (`occurrenceDate`, `state`: `done`\|`skipped`) |
| GET | `/api/events?date=YYYY-MM-DD` (or `?start=&end=`) | Completion events across all activities in a date range |
| GET | `/api/grocery-items` | List, unchecked first |
| POST | `/api/grocery-items` | Create (`name` required; `quantity`, `unit`, `note` optional) |
| PUT | `/api/grocery-items/:id` | Partial update (e.g. toggle `checked`) |
| DELETE | `/api/grocery-items/:id` | Remove one item |
| DELETE | `/api/grocery-items/checked` | Bulk-remove everything checked off |

`recurrenceRule` / `trackingSpec` are passed through as opaque JSON
matching `dayly-app/lib/data/drift/json_codecs.dart`'s shapes (e.g.
`{"type": "dailyFixedTimes", "times": [{"h": 8, "m": 0}]}`) — this
backend only checks that `recurrenceRule` is an object with a `type`
key, never the full sealed-hierarchy shape, so a new client-side
recurrence variant never needs a backend change to pass through.
