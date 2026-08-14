require('dotenv').config();

const required = [
  'DATABASE_URL',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(
      `Missing required env var "${key}". Copy .env.example to .env and fill it in.`
    );
  }
}

// Render's managed Postgres (and most hosted providers) requires SSL;
// a plain local Postgres usually isn't configured for it at all, so this
// can't be a single hardcoded setting. Default it off for localhost,
// on for anything else, and let PGSSL override either way for edge cases
// (e.g. a hosted DB reachable over a private, unencrypted network).
function resolvePgSsl() {
  if (process.env.PGSSL === 'true') return true;
  if (process.env.PGSSL === 'false') return false;

  const { hostname } = new URL(process.env.DATABASE_URL);
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  return !isLocal;
}

module.exports = {
  port: process.env.PORT || 4000,
  databaseUrl: process.env.DATABASE_URL,
  // Render's certs aren't in Node's default trust store chain the way a
  // public CA's would be, so this stays `rejectUnauthorized: false` —
  // the connection is still encrypted, just not chain-verified. That's
  // the standard/documented setting for connecting to Render Postgres.
  pgSsl: resolvePgSsl() ? { rejectUnauthorized: false } : false,
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // .env stores the literal "\n" escape sequence from the downloaded
    // service account JSON; turn it back into real newlines here, the
    // one place that translation needs to happen.
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
};
