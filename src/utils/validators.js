// Small, dependency-free checks shared by routes that accept
// user-supplied numbers/dates/booleans — enough to turn a malformed
// field into a 400 before it ever reaches a query, instead of a raw
// Postgres cast error surfacing as an opaque 500.

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(value) {
  if (typeof value !== 'string' || !DATE_ONLY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
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

module.exports = { isValidDateString, isNonNegativeInteger, isFiniteNumber, isBoolean };
