const { Pool } = require('pg');
const env = require('./env');

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
