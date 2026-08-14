const pool = require('../config/db');

function toDomain(row) {
  return {
    id: row.id,
    activityId: row.activity_id,
    occurrenceDate: row.occurrence_date,
    occurrenceIndex: row.occurrence_index,
    state: row.state,
    loggedValue: row.logged_value,
    recordedAt: row.recorded_at,
  };
}

// Append-only, mirroring the client's CompletionEvents table: there is no
// update() here on purpose. Recording the same occurrence twice is a new
// row, not a mutation — whoever reads events folds them down to current
// state by `recordedAt`/`recorded_at`, same as the engine does client-side.
async function append(userId, activityId, event) {
  // Ownership check first: an activity id belonging to another user
  // should read as "doesn't exist" here too, not silently attach an
  // event to it.
  const owned = await pool.query(
    'SELECT 1 FROM dayly.activities WHERE id = $1 AND user_id = $2',
    [activityId, userId]
  );
  if (owned.rows.length === 0) {
    const err = new Error('Activity not found.');
    err.status = 404;
    err.expose = true;
    throw err;
  }

  const { rows } = await pool.query(
    `INSERT INTO dayly.completion_events
       (activity_id, user_id, occurrence_date, occurrence_index, state, logged_value)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      activityId,
      userId,
      event.occurrenceDate,
      event.occurrenceIndex ?? 0,
      event.state,
      event.loggedValue == null ? null : JSON.stringify(event.loggedValue),
    ]
  );
  return toDomain(rows[0]);
}

// Every event ever recorded for one activity, oldest first — a caller
// (or a future sync job) folds these down to current state per
// occurrence the same way the client's engine does.
async function getForActivity(userId, activityId) {
  const { rows } = await pool.query(
    `SELECT * FROM dayly.completion_events
     WHERE user_id = $1 AND activity_id = $2
     ORDER BY recorded_at ASC`,
    [userId, activityId]
  );
  return rows.map(toDomain);
}

// Every event in a date range across all of a user's activities — the
// shape a "Today feed" or history view actually needs, without forcing
// N requests (one per activity).
async function getForDateRange(userId, startDate, endDate) {
  const { rows } = await pool.query(
    `SELECT * FROM dayly.completion_events
     WHERE user_id = $1 AND occurrence_date BETWEEN $2 AND $3
     ORDER BY occurrence_date ASC, recorded_at ASC`,
    [userId, startDate, endDate]
  );
  return rows.map(toDomain);
}

module.exports = { append, getForActivity, getForDateRange };
