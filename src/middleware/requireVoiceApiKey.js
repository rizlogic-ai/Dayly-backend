const env = require('../config/env');

// `/api/voice/parse` predates any client-side login (the Flutter app has
// no Firebase Auth integration, so it can't send a real Bearer token),
// so it can't reuse `authenticate`. This is a lighter shared-secret gate
// instead — enough to stop a random caller from burning the OpenAI
// quota, not a real per-user auth scheme. If VOICE_API_KEY isn't set,
// this no-ops (see env.js's comment on why that's the safer default
// during early testing rather than a hard boot-time requirement).
module.exports = (req, res, next) => {
  if (!env.voiceApiKey) return next();

  const provided = req.headers['x-voice-api-key'];
  if (provided !== env.voiceApiKey) {
    return res.status(401).json({ error: 'Invalid or missing X-Voice-Api-Key header.' });
  }
  next();
};
