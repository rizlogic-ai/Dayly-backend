const admin = require('../config/firebase');
const usersRepository = require('../repositories/users.repository');
const asyncHandler = require('./asyncHandler');

// Every protected route expects `Authorization: Bearer <Firebase ID token>`.
// The client signs in with Firebase Auth (any provider) and forwards the
// ID token as-is — this backend never sees a password. Verifying it here
// and upserting the local `users` row on every request is what makes a
// separate "login" or "register" endpoint unnecessary: the first
// authenticated request from a new Firebase user *is* the signup.
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  req.user = await usersRepository.upsertFromFirebaseUser({
    firebaseUid: decoded.uid,
    email: decoded.email,
    displayName: decoded.name,
  });

  next();
});

module.exports = authenticate;
