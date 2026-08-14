const { Pool, types } = require('pg');
const env = require('./env');

// pg's default DATE (OID 1082) parser returns a JS Date at *local*
// midnight in the server process's timezone, then `res.json()` serializes
// it via toISOString() (UTC) — on any server whose local TZ is behind
// UTC, a stored '2026-08-20' silently comes back as
// '2026-08-19T...Z'. completion_events.occurrence_date is only ever
// compared/stored as a plain calendar date, so keep it as the literal
// 'YYYY-MM-DD' string Postgres sends instead of round-tripping it
// through a Date at all.
types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.pgSsl,
});

pool.on('error', (err) => {
  // A idle client erroring out (e.g. connection dropped) should not crash
  // the whole process — the pool discards that client and issues a fresh
  // one on the next query.
  console.error('Unexpected error on idle Postgres client', err);
});

module.exports = pool;
