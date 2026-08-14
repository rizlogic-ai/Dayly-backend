const express = require('express');
const crypto = require('crypto');
const asyncHandler = require('../middleware/asyncHandler');
const activitiesRepository = require('../repositories/activities.repository');
const eventsRepository = require('../repositories/events.repository');
const { MODULE_TYPES } = require('../constants/moduleTypes');
const { isValidDateString, isNonNegativeInteger } = require('../utils/validators');

const router = express.Router();

// Only the fields this backend actually needs to validate before
// persisting. `recurrenceRule`/`trackingSpec` are passed through as
// opaque JSON — see schema.sql's comment on why this never re-validates
// their sealed-hierarchy shape itself.
function validateActivityBody(body) {
  if (typeof body.title !== 'string' || body.title.trim() === '') {
    return 'title is required.';
  }
  if (!MODULE_TYPES.includes(body.moduleType)) {
    return `moduleType must be one of: ${MODULE_TYPES.join(', ')}.`;
  }
  if (typeof body.recurrenceRule !== 'object' || body.recurrenceRule === null || !body.recurrenceRule.type) {
    return 'recurrenceRule must be an object with a "type" field.';
  }
  return null;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const includeArchived = req.query.includeArchived === 'true';
    res.json(await activitiesRepository.getAllForUser(req.user.id, { includeArchived }));
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const activity = await activitiesRepository.getById(req.user.id, req.params.id);
    if (!activity) return res.status(404).json({ error: 'Activity not found.' });
    res.json(activity);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const error = validateActivityBody(req.body);
    if (error) return res.status(400).json({ error });

    const saved = await activitiesRepository.save(req.user.id, {
      ...req.body,
      id: req.body.id || crypto.randomUUID(),
      createdAt: req.body.createdAt ? new Date(req.body.createdAt) : new Date(),
    });
    res.status(201).json(saved);
  })
);

// Full save-in-place, matching the client's own save() semantics (create
// and edit share one path there too) — the id in the URL always wins
// over any id in the body. Only title/moduleType/recurrenceRule are
// required on the wire; note/trackingSpec/reminderEnabled/archivedAt
// fall back to the existing row when the client omits them, so a caller
// that only wants to change the title doesn't have to resend everything
// (and, critically, doesn't silently wipe the rest back to defaults).
// `'key' in req.body` — not `req.body.key ?? existing`— is what lets an
// explicit `null` (e.g. clearing archivedAt) win over "key wasn't sent."
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const error = validateActivityBody(req.body);
    if (error) return res.status(400).json({ error });

    const existing = await activitiesRepository.getById(req.user.id, req.params.id);

    const saved = await activitiesRepository.save(req.user.id, {
      title: req.body.title,
      moduleType: req.body.moduleType,
      recurrenceRule: req.body.recurrenceRule,
      note: 'note' in req.body ? req.body.note : existing?.note ?? null,
      trackingSpec: 'trackingSpec' in req.body
        ? req.body.trackingSpec
        : existing?.trackingSpec ?? { type: 'none' },
      reminderEnabled: 'reminderEnabled' in req.body
        ? req.body.reminderEnabled
        : existing?.reminderEnabled ?? false,
      id: req.params.id,
      createdAt: existing ? existing.createdAt : new Date(),
      archivedAt: 'archivedAt' in req.body
        ? req.body.archivedAt
        : existing?.archivedAt ?? null,
    });
    res.json(saved);
  })
);

router.post(
  '/:id/archive',
  asyncHandler(async (req, res) => {
    const archived = await activitiesRepository.archive(req.user.id, req.params.id, new Date());
    if (!archived) return res.status(404).json({ error: 'Activity not found.' });
    res.json(archived);
  })
);

router.post(
  '/:id/restore',
  asyncHandler(async (req, res) => {
    const restored = await activitiesRepository.restore(req.user.id, req.params.id);
    if (!restored) return res.status(404).json({ error: 'Activity not found.' });
    res.json(restored);
  })
);

router.get(
  '/:id/events',
  asyncHandler(async (req, res) => {
    res.json(await eventsRepository.getForActivity(req.user.id, req.params.id));
  })
);

router.post(
  '/:id/events',
  asyncHandler(async (req, res) => {
    const { occurrenceDate, occurrenceIndex, state, loggedValue } = req.body;

    if (!isValidDateString(occurrenceDate)) {
      return res.status(400).json({ error: 'occurrenceDate is required and must be "YYYY-MM-DD".' });
    }
    if (occurrenceIndex !== undefined && !isNonNegativeInteger(occurrenceIndex)) {
      return res.status(400).json({ error: 'occurrenceIndex must be a non-negative integer.' });
    }
    if (state !== 'done' && state !== 'skipped') {
      return res.status(400).json({ error: 'state must be "done" or "skipped".' });
    }

    const event = await eventsRepository.append(req.user.id, req.params.id, {
      occurrenceDate,
      occurrenceIndex,
      state,
      loggedValue,
    });
    res.status(201).json(event);
  })
);

module.exports = router;
