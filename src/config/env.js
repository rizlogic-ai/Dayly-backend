require('dotenv').config();

const { shouldUseSsl } = require('../utils/ssl');

if (!process.env.DATABASE_URL) {
  throw new Error('Missing required env var "DATABASE_URL". Copy .env.example to .env and fill it in.');
}

// Two ways to supply Firebase Admin credentials:
//
// 1. FIREBASE_SERVICE_ACCOUNT_BASE64 — the *entire* downloaded service
//    account JSON, base64-encoded into one line. Preferred: base64 has no
//    newlines or quote characters, so there is nothing for a hosting
//    platform's env-var UI to mangle. This is the fix for a real
//    production failure — Render's env var editor doesn't reliably
//    preserve a literal multi-line PEM through option 2 below (it
//    surfaced as both "admin.apps undefined" further downstream and,
//    separately, `ERR_OSSL_UNSUPPORTED` — Node's PEM decoder choking on
//    a corrupted/mangled key). JSON.parse un-escapes `\n` to real
//    newlines on its own, so the private key comes out already correct.
//
// 2. FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
//    as three discrete vars — kept for local dev convenience (faster to
//    hand-edit in .env than to regenerate a base64 blob every time), but
//    fragile on hosting platforms for the reason above. Prefer option 1
//    for any real deployment.
function resolveFirebaseCredentials() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    let parsed;
    try {
      const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
      parsed = JSON.parse(json);
    } catch (err) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 is not valid base64-encoded JSON.');
    }
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_BASE64 decoded but is missing project_id/client_email/private_key.'
      );
    }
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
    };
  }

  const required = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(
        `Missing required env var "${key}" (or set FIREBASE_SERVICE_ACCOUNT_BASE64 instead). ` +
          'Copy .env.example to .env and fill it in.'
      );
    }
  }
  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // .env stores the literal "\n" escape sequence from the downloaded
    // service account JSON; turn it back into real newlines here, the
    // one place that translation needs to happen for this path.
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  };
}

// Undefined means "allow any origin" (cors()'s own default) — fine for
// now since auth is a Bearer header, not a cookie, so there's no
// credentialed-CORS CSRF exposure. Set once a browser-based client
// exists and origins are actually known.
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : undefined;

module.exports = {
  port: process.env.PORT || 4000,
  databaseUrl: process.env.DATABASE_URL,
  corsOrigins,
  // Render's certs aren't in Node's default trust store chain the way a
  // public CA's would be, so this stays `rejectUnauthorized: false` —
  // the connection is still encrypted, just not chain-verified. That's
  // the standard/documented setting for connecting to Render Postgres.
  pgSsl: shouldUseSsl(process.env.DATABASE_URL, process.env.PGSSL) ? { rejectUnauthorized: false } : false,
  firebase: resolveFirebaseCredentials(),
};
