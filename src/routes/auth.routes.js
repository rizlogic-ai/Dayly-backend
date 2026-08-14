const express = require('express');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../middleware/asyncHandler');
const preferencesRepository = require('../repositories/preferences.repository');

const router = express.Router();

// The client calls this immediately after Firebase sign-in. `authenticate`
// has already verified the token and upserted the `users` row by the
// time this handler runs — this endpoint's only job is to hand back the
// user profile + preferences in one response, so the client doesn't need
// a second round trip on every app launch.
router.post(
  '/session',
  authenticate,
  asyncHandler(async (req, res) => {
    const preferences = await preferencesRepository.getOrCreate(req.user.id);
    res.json({ user: req.user, preferences });
  })
);

module.exports = router;
