const pool = require('../config/db');

function toDomain(row) {
  return {
    id: row.id,
    firebaseUid: row.firebase_uid,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

// The one write path that ever creates a `users` row — called from the
// authenticate middleware once a Firebase ID token has been verified.
// This *is* the login table: there is no password, no separate signup
// endpoint, just "a verified Firebase UID we've seen before gets its
// last_login_at bumped; one we haven't gets a new row."
async function upsertFromFirebaseUser({ firebaseUid, email, displayName }) {
  const { rows } = await pool.query(
    `INSERT INTO dayly.users (firebase_uid, email, display_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (firebase_uid) DO UPDATE SET
       email = EXCLUDED.email,
       display_name = EXCLUDED.display_name,
       last_login_at = now()
     RETURNING *`,
    [firebaseUid, email ?? null, displayName ?? null]
  );
  return toDomain(rows[0]);
}

async function getById(id) {
  const { rows } = await pool.query('SELECT * FROM dayly.users WHERE id = $1', [id]);
  return rows[0] ? toDomain(rows[0]) : null;
}

module.exports = { upsertFromFirebaseUser, getById };
