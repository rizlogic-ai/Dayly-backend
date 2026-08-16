// Small, dependency-free checks shared by routes that accept
// user-supplied numbers/dates/booleans — enough to turn a malformed
// field into a 400 before it ever reaches a query, instead of a raw
// Postgres cast error surfacing as an opaque 500.
//
// Body-shape validators for activities/grocery-items/preferences live
// here too (not inline in their route files) specifically so they're
// unit-testable without booting Express or touching Postgres/Firebase —
// see test/validators.test.js.

const { MODULE_TYPES } = require('../constants/moduleTypes');

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(value) {
  if (typeof value !== 'string' || !DATE_ONLY.test(value)) return false;

  // New Date(...) silently rolls overflowing days into the next month
  // (2026-02-30 becomes March 2) instead of rejecting it — round-trip
  // the parsed components back and compare to catch that.
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function isNonNegativeInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBoolean(value) {
  return typeof value === 'boolean';
}

// Matches every CompletionState the client's domain layer can produce
// (dayly-app/lib/domain/completion_state.dart) — including 'pending',
// which is what an "uncheck" appends, not just the two terminal states.
// See schema.sql's CHECK constraint comment for why 'pending' has to be
// a real, storable value here too.
const EVENT_STATES = ['pending', 'done', 'skipped'];

function isValidEventState(value) {
  return EVENT_STATES.includes(value);
}

// Only the fields this backend actually needs to validate before
// persisting. `recurrenceRule`/`trackingSpec` are passed through as
// opaque JSON — see schema.sql's comment on why this never re-validates
// their sealed-hierarchy shape itself.
function validateActivityBody(body) {
  if (typeof body.title !== 'string' || body.title.trim() === '') {
    return 'title is required.';
  }
  if (!MODULE_TYPES.includes(body.moduleType)) {
    return `moduleType must be one of: ${MODULE_TYPES.join(', ')}.`;
  }
  if (typeof body.recurrenceRule !== 'object' || body.recurrenceRule === null || !body.recurrenceRule.type) {
    return 'recurrenceRule must be an object with a "type" field.';
  }
  return null;
}

// `requireName`: true for POST (name is mandatory), false for PUT (name
// is one of several optionally-patched fields) — everything else here is
// "if present, must be the right type," never mandatory on either verb.
function validateGroceryBody(body, { requireName }) {
  if (requireName && (typeof body.name !== 'string' || body.name.trim() === '')) {
    return 'name is required.';
  }
  if (body.name !== undefined && typeof body.name !== 'string') {
    return 'name must be a string.';
  }
  if (body.quantity !== undefined && body.quantity !== null && !isFiniteNumber(body.quantity)) {
    return 'quantity must be a number.';
  }
  if (body.unit !== undefined && body.unit !== null && typeof body.unit !== 'string') {
    return 'unit must be a string.';
  }
  if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') {
    return 'note must be a string.';
  }
  if (body.checked !== undefined && !isBoolean(body.checked)) {
    return 'checked must be a boolean.';
  }
  return null;
}

function validatePreferencesBody(body) {
  const { onboardingComplete, enabledModules, homeLocation, prayerCalculationParams } = body;

  if (onboardingComplete !== undefined && !isBoolean(onboardingComplete)) {
    return 'onboardingComplete must be a boolean.';
  }
  if (enabledModules !== undefined) {
    if (!Array.isArray(enabledModules) || enabledModules.some((m) => !MODULE_TYPES.includes(m))) {
      return `enabledModules must be an array of: ${MODULE_TYPES.join(', ')}.`;
    }
  }
  if (homeLocation !== undefined && homeLocation !== null && typeof homeLocation !== 'string') {
    return 'homeLocation must be a string or null.';
  }
  if (
    prayerCalculationParams !== undefined &&
    prayerCalculationParams !== null &&
    typeof prayerCalculationParams !== 'object'
  ) {
    return 'prayerCalculationParams must be an object or null.';
  }
  return null;
}

module.exports = {
  isValidDateString,
  isNonNegativeInteger,
  isFiniteNumber,
  isBoolean,
  isValidEventState,
  validateActivityBody,
  validateGroceryBody,
  validatePreferencesBody,
};
