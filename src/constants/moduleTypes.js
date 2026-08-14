// Mirrors dayly-app/lib/domain/module_type.dart's ModuleType enum. Kept
// as a flat list rather than a DB CHECK constraint on activities.module_type
// — a CHECK would need a migration every time the client adds a life-area,
// which fights the client's own "adding a module type is one data entry,
// not a schema change" design. This list only gates request validation.
const MODULE_TYPES = [
  'medicine',
  'prayer',
  'fitness',
  'task',
  'water',
  'sleep',
  'habit',
  'bill',
  'journal',
  'appointment',
];

module.exports = { MODULE_TYPES };
