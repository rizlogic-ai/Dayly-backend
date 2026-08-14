const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const eventsRepository = require('../repositories/events.repository');
const { isValidDateString } = require('../utils/validators');

const router = express.Router();

// Cross-activity range query — what a "Today" or history view actually
// needs (every event across every activity for a date range), as
// opposed to activities.routes.js's /:id/events which is scoped to one
// activity. ?date=YYYY-MM-DD is shorthand for a single-day range.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { date, start, end } = req.query;
    const startDate = date || start;
    const endDate = date || end;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Provide either ?date= or both ?start= and ?end=.' });
    }
    if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
      return res.status(400).json({ error: 'Dates must be in "YYYY-MM-DD" format.' });
    }

    res.json(await eventsRepository.getForDateRange(req.user.id, startDate, endDate));
  })
);

module.exports = router;
