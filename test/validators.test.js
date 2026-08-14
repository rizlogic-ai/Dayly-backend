// Unit tests for the pure validation logic in src/utils/validators.js.
// These need no database, no Firebase, no running server — run with
// `npm test` (plain `node --test`, no test framework dependency).
//
// This is deliberately the extent of automated coverage for now: every
// repository method is a thin wrapper over a real Postgres query, and
// this repo has no DATABASE_URL for a real (or disposable/ephemeral)
// database to test against yet. Once one exists, repositories/routes are
// the next layer worth covering — this suite only closes the "malformed
// input reaches Postgres as a 500 instead of a 400" gap identified in
// the QA audit.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  isValidDateString,
  isNonNegativeInteger,
  isFiniteNumber,
  isBoolean,
  validateActivityBody,
  validateGroceryBody,
  validatePreferencesBody,
} = require('../src/utils/validators');

describe('isValidDateString', () => {
  test('accepts a well-formed calendar date', () => {
    assert.equal(isValidDateString('2026-08-20'), true);
  });

  test('rejects non-date-shaped strings', () => {
    assert.equal(isValidDateString('not-a-date'), false);
    assert.equal(isValidDateString('2026/08/20'), false);
    assert.equal(isValidDateString('08-20-2026'), false);
  });

  test('rejects a calendar-shaped but nonexistent date', () => {
    assert.equal(isValidDateString('2026-02-30'), false);
  });

  test('rejects non-strings and missing values', () => {
    assert.equal(isValidDateString(20260820), false);
    assert.equal(isValidDateString(undefined), false);
    assert.equal(isValidDateString(null), false);
  });
});

describe('isNonNegativeInteger', () => {
  test('accepts zero and positive integers', () => {
    assert.equal(isNonNegativeInteger(0), true);
    assert.equal(isNonNegativeInteger(3), true);
  });

  test('rejects negatives, floats, and non-numbers', () => {
    assert.equal(isNonNegativeInteger(-1), false);
    assert.equal(isNonNegativeInteger(1.5), false);
    assert.equal(isNonNegativeInteger('2'), false);
  });
});

describe('isFiniteNumber / isBoolean', () => {
  test('isFiniteNumber rejects NaN/Infinity/strings', () => {
    assert.equal(isFiniteNumber(2.5), true);
    assert.equal(isFiniteNumber(NaN), false);
    assert.equal(isFiniteNumber(Infinity), false);
    assert.equal(isFiniteNumber('2.5'), false);
  });

  test('isBoolean only accepts real booleans', () => {
    assert.equal(isBoolean(true), true);
    assert.equal(isBoolean('true'), false);
    assert.equal(isBoolean(1), false);
  });
});

describe('validateActivityBody', () => {
  const validBody = () => ({
    title: 'Metformin',
    moduleType: 'medicine',
    recurrenceRule: { type: 'dailyFixedTimes', times: [{ h: 8, m: 0 }] },
  });

  test('accepts a well-formed body', () => {
    assert.equal(validateActivityBody(validBody()), null);
  });

  test('rejects an empty or missing title', () => {
    assert.match(validateActivityBody({ ...validBody(), title: '' }), /title/);
    assert.match(validateActivityBody({ ...validBody(), title: '   ' }), /title/);
    const { title, ...withoutTitle } = validBody();
    assert.match(validateActivityBody(withoutTitle), /title/);
  });

  test('rejects an unknown moduleType', () => {
    assert.match(validateActivityBody({ ...validBody(), moduleType: 'nonsense' }), /moduleType/);
  });

  test('rejects a recurrenceRule with no type, or that is not an object', () => {
    assert.match(validateActivityBody({ ...validBody(), recurrenceRule: {} }), /recurrenceRule/);
    assert.match(validateActivityBody({ ...validBody(), recurrenceRule: 'oneTime' }), /recurrenceRule/);
    assert.match(validateActivityBody({ ...validBody(), recurrenceRule: null }), /recurrenceRule/);
  });

  test('accepts the new OneTime recurrence shape untouched (opaque JSON passthrough)', () => {
    const body = {
      ...validBody(),
      recurrenceRule: { type: 'oneTime', date: '2026-08-20T00:00:00.000Z', time: null },
    };
    assert.equal(validateActivityBody(body), null);
  });
});

describe('validateGroceryBody', () => {
  test('POST (requireName: true) rejects a missing name', () => {
    assert.match(validateGroceryBody({}, { requireName: true }), /name/);
  });

  test('PUT (requireName: false) allows omitting name entirely', () => {
    assert.equal(validateGroceryBody({ checked: true }, { requireName: false }), null);
  });

  test('rejects wrong types for quantity/unit/note/checked when present', () => {
    assert.match(validateGroceryBody({ name: 'Milk', quantity: 'two' }, { requireName: true }), /quantity/);
    assert.match(validateGroceryBody({ name: 'Milk', unit: 5 }, { requireName: true }), /unit/);
    assert.match(validateGroceryBody({ name: 'Milk', note: 5 }, { requireName: true }), /note/);
    assert.match(validateGroceryBody({ name: 'Milk', checked: 'yes' }, { requireName: true }), /checked/);
  });

  test('null is accepted for nullable optional fields', () => {
    const body = { name: 'Milk', quantity: null, unit: null, note: null };
    assert.equal(validateGroceryBody(body, { requireName: true }), null);
  });
});

describe('validatePreferencesBody', () => {
  test('accepts an empty patch (every field is optional)', () => {
    assert.equal(validatePreferencesBody({}), null);
  });

  test('rejects a non-boolean onboardingComplete', () => {
    assert.match(validatePreferencesBody({ onboardingComplete: 'yes' }), /onboardingComplete/);
  });

  test('rejects enabledModules with an unknown module type', () => {
    assert.match(validatePreferencesBody({ enabledModules: ['medicine', 'not-a-module'] }), /enabledModules/);
  });

  test('accepts a valid enabledModules list', () => {
    assert.equal(validatePreferencesBody({ enabledModules: ['medicine', 'water'] }), null);
  });

  test('rejects a non-string, non-null homeLocation', () => {
    assert.match(validatePreferencesBody({ homeLocation: 42 }), /homeLocation/);
  });

  test('accepts null for homeLocation and prayerCalculationParams', () => {
    assert.equal(validatePreferencesBody({ homeLocation: null, prayerCalculationParams: null }), null);
  });
});
