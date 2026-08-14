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

module.exports = {
  port: process.env.PORT || 4000,
  databaseUrl: process.env.DATABASE_URL,
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // .env stores the literal "\n" escape sequence from the downloaded
    // service account JSON; turn it back into real newlines here, the
    // one place that translation needs to happen.
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
};
