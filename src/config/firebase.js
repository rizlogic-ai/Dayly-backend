// firebase-admin v13+ dropped the old namespaced API (`admin.apps`,
// `admin.credential.cert`, `admin.auth()`) in favor of modular subpath
// exports — `admin.apps` is simply `undefined` now, not an empty array,
// which is what broke `if (!admin.apps.length)` here until this file was
// rewritten. `getApps()` is the direct replacement.
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const env = require('./env');

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: env.firebase.projectId,
      clientEmail: env.firebase.clientEmail,
      privateKey: env.firebase.privateKey,
    }),
  });
}

// The only thing any caller in this codebase needs from Firebase Admin —
// export the Auth instance directly rather than the whole namespace.
module.exports = getAuth();
