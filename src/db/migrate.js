// Applies schema.sql against DATABASE_URL. Every statement in schema.sql
// is written with IF NOT EXISTS / CREATE EXTENSION IF NOT EXISTS, so
// running this repeatedly is always safe — there is no separate
// "migrations" table or version tracking, matching the "simple" brief
// for a module this size. If the schema ever needs a breaking change
// later (renaming/dropping a column), that's the point to introduce a
// real migration tool; nothing here is designed to block that later.
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  console.log('Applying schema.sql...');
  await pool.query(schema);
  console.log('Schema is up to date.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
