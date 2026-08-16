-- Dayly backend schema.
--
-- Mirrors the Flutter app's own domain (see dayly-app/ARCHITECTURE.md):
-- an Activity is the one primitive every life-area (medicine, prayer,
-- fitness, tasks, ...) reduces to, with `recurrence_rule` and
-- `tracking_spec` stored as JSON the same way the client's Drift layer
-- stores them — the backend doesn't re-model that sealed-hierarchy logic,
-- it just persists whatever shape the client already validated.
--
-- Identity comes from Firebase Auth: this file only ever creates rows in
-- `users` via the authenticate middleware upserting a verified Firebase
-- UID, never a self-serve signup path.
--
-- Everything lives under its own `dayly` schema rather than `public`, so
-- this can share a Postgres instance/database with other projects
-- (this machine already has at least one) without any table-name
-- collision risk.

CREATE SCHEMA IF NOT EXISTS dayly;

-- gen_random_uuid() below resolves via whatever schema pgcrypto installs
-- into (typically public, which stays on the default search_path) — the
-- extension itself is intentionally not schema-qualified.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS dayly.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per user. Mirrors the client's AppSettings: onboarding state,
-- which modules are enabled, home location, prayer calculation params.
-- This is the "user plan" — what the user has set up, not a separate
-- entity, same as the Flutter app's Plan tab has no persisted model of
-- its own beyond activities + these preferences.
CREATE TABLE IF NOT EXISTS dayly.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES dayly.users(id) ON DELETE CASCADE,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  enabled_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  home_location TEXT,
  prayer_calculation_params JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- `id` is TEXT, not a server-generated UUID: the Flutter client already
-- mints its own activity ids (see activity_draft.dart's _generateId), and
-- keeping the same id space means a client-created activity round-trips
-- through sync without translation.
CREATE TABLE IF NOT EXISTS dayly.activities (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES dayly.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  module_type TEXT NOT NULL,
  note TEXT,
  recurrence_rule JSONB NOT NULL,
  tracking_spec JSONB NOT NULL DEFAULT '{"type":"none"}'::jsonb,
  reminder_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_activities_user ON dayly.activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_user_active
  ON dayly.activities(user_id) WHERE archived_at IS NULL;

-- Append-only, same as the client's CompletionEvents table: never
-- UPDATEd, only inserted. Current state for a given occurrence is
-- whatever the caller folds from the latest row by `recorded_at`.
--
-- 'pending' is a real, storable state, not just a derived default: the
-- client's TodayController.uncheck() appends a 'pending' event (see
-- dayly-app/lib/data/drift/drift_completion_repository.dart — its
-- CompletionEvents table has no CHECK at all, so it already accepts
-- whatever CompletionState the domain layer passes). Without it here,
-- syncing an "uncheck" action would be rejected by this constraint —
-- the fold would keep showing "done" on the backend forever after a
-- client-side uncheck.
CREATE TABLE IF NOT EXISTS dayly.completion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id TEXT NOT NULL REFERENCES dayly.activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES dayly.users(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  occurrence_index INT NOT NULL DEFAULT 0,
  state TEXT NOT NULL CHECK (state IN ('pending', 'done', 'skipped')),
  logged_value JSONB,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Widens the CHECK for a database that already ran an earlier version
-- of this schema (CREATE TABLE IF NOT EXISTS above is a no-op for an
-- existing table, so the constraint itself needs its own migration
-- path). Safe to re-run: DROP ... IF EXISTS, then re-add unconditionally.
-- `completion_events_state_check` is Postgres's own default name for an
-- unnamed CHECK on this column (`{table}_{column}_check`).
ALTER TABLE dayly.completion_events DROP CONSTRAINT IF EXISTS completion_events_state_check;
ALTER TABLE dayly.completion_events ADD CONSTRAINT completion_events_state_check
  CHECK (state IN ('pending', 'done', 'skipped'));

CREATE INDEX IF NOT EXISTS idx_completion_events_activity_date
  ON dayly.completion_events(activity_id, occurrence_date, occurrence_index);
CREATE INDEX IF NOT EXISTS idx_completion_events_user
  ON dayly.completion_events(user_id);

-- New for the backend — no client-side equivalent yet. A flat per-user
-- list rather than per-activity, since groceries aren't scheduled
-- occurrences of anything; `checked` is the shopping-cart tick, not a
-- CompletionEvent (there's nothing to fold — one item has one state).
CREATE TABLE IF NOT EXISTS dayly.grocery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dayly.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity NUMERIC,
  unit TEXT,
  note TEXT,
  checked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grocery_items_user ON dayly.grocery_items(user_id);
