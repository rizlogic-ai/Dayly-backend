const pool = require('../config/db');

function toDomain(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    moduleType: row.module_type,
    note: row.note,
    recurrenceRule: row.recurrence_rule,
    trackingSpec: row.tracking_spec,
    reminderEnabled: row.reminder_enabled,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

// Every query here is scoped by `user_id` in addition to the row's own
// id — the only thing standing between one user reading/editing another
// user's activities is this WHERE clause, since ids themselves aren't
// secret (the client generates them, see schema.sql's comment on
// `activities.id`).
async function getAllForUser(userId, { includeArchived = false } = {}) {
  const { rows } = await pool.query(
    `SELECT * FROM dayly.activities
     WHERE user_id = $1 ${includeArchived ? '' : 'AND archived_at IS NULL'}
     ORDER BY created_at ASC`,
    [userId]
  );
  return rows.map(toDomain);
}

async function getById(userId, id) {
  const { rows } = await pool.query(
    'SELECT * FROM dayly.activities WHERE user_id = $1 AND id = $2',
    [userId, id]
  );
  return rows[0] ? toDomain(rows[0]) : null;
}

// Upsert on `id`: the client mints activity ids itself (create and edit
// use the same code path there), so "save" is naturally insert-or-replace
// rather than needing separate create/update repository methods.
async function save(userId, activity) {
  const { rows } = await pool.query(
    `INSERT INTO dayly.activities
       (id, user_id, title, module_type, note, recurrence_rule, tracking_spec, reminder_enabled, created_at, archived_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       module_type = EXCLUDED.module_type,
       note = EXCLUDED.note,
       recurrence_rule = EXCLUDED.recurrence_rule,
       tracking_spec = EXCLUDED.tracking_spec,
       reminder_enabled = EXCLUDED.reminder_enabled,
       archived_at = EXCLUDED.archived_at
     WHERE dayly.activities.user_id = $2
     RETURNING *`,
    [
      activity.id,
      userId,
      activity.title,
      activity.moduleType,
      activity.note ?? null,
      JSON.stringify(activity.recurrenceRule),
      JSON.stringify(activity.trackingSpec ?? { type: 'none' }),
      activity.reminderEnabled ?? false,
      activity.createdAt ?? new Date(),
      activity.archivedAt ?? null,
    ]
  );

  if (!rows[0]) {
    // The ON CONFLICT's WHERE guard didn't match — the id belongs to
    // another user's activity. Surfacing that as "not found" rather than
    // a generic 500 keeps the ownership check from leaking whether the
    // id exists at all.
    const err = new Error('Activity not found.');
    err.status = 404;
    err.expose = true;
    throw err;
  }
  return toDomain(rows[0]);
}

// Archive, never delete — same rule the client's own repository follows
// (see ARCHITECTURE.md: "Archive, never delete"). Past completion events
// stay attached and queryable either way.
async function archive(userId, id, archivedAt) {
  const { rows } = await pool.query(
    `UPDATE dayly.activities SET archived_at = $3
     WHERE user_id = $1 AND id = $2
     RETURNING *`,
    [userId, id, archivedAt]
  );
  return rows[0] ? toDomain(rows[0]) : null;
}

module.exports = { getAllForUser, getById, save, archive };
