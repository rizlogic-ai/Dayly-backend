// Pulled out of config/env.js so this can be unit-tested without also
// requiring the four Firebase env vars env.js insists on at load time.
// Render's managed Postgres (and most hosted providers) requires SSL; a
// plain local Postgres usually isn't configured for it at all, so this
// can't be a single hardcoded setting.
function shouldUseSsl(databaseUrl, overrideEnvValue) {
  if (overrideEnvValue === 'true') return true;
  if (overrideEnvValue === 'false') return false;

  const { hostname } = new URL(databaseUrl);
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  return !isLocal;
}

module.exports = { shouldUseSsl };
