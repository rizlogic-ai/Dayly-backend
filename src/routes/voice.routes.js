const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { classifyVoiceCommand } = require('../services/openaiVoiceParser');

const router = express.Router();

// Generous but bounded — a real spoken command is a sentence or two;
// this just stops a pathological payload from reaching OpenAI at all.
const MAX_TRANSCRIPT_LENGTH = 500;

router.post(
  '/parse',
  asyncHandler(async (req, res) => {
    const { transcript, now } = req.body;

    if (typeof transcript !== 'string' || transcript.trim() === '') {
      return res.status(400).json({ error: 'transcript is required.' });
    }
    if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
      return res.status(400).json({ error: `transcript must be ${MAX_TRANSCRIPT_LENGTH} characters or fewer.` });
    }

    let nowIso = new Date().toISOString();
    if (now !== undefined) {
      if (typeof now !== 'string' || Number.isNaN(Date.parse(now))) {
        return res.status(400).json({ error: 'now, if provided, must be a valid ISO 8601 date-time string.' });
      }
      nowIso = now;
    }

    const result = await classifyVoiceCommand({ transcript, now: nowIso });
    res.json(result);
  })
);

module.exports = router;
