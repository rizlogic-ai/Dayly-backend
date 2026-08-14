const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const preferencesRepository = require('../repositories/preferences.repository');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await preferencesRepository.getOrCreate(req.user.id));
  })
);

router.put(
  '/',
  asyncHandler(async (req, res) => {
    const { onboardingComplete, enabledModules, homeLocation, prayerCalculationParams } = req.body;

    if (enabledModules !== undefined && !Array.isArray(enabledModules)) {
      return res.status(400).json({ error: 'enabledModules must be an array.' });
    }

    const updated = await preferencesRepository.update(req.user.id, {
      ...(onboardingComplete !== undefined && { onboardingComplete }),
      ...(enabledModules !== undefined && { enabledModules }),
      ...(homeLocation !== undefined && { homeLocation }),
      ...(prayerCalculationParams !== undefined && { prayerCalculationParams }),
    });
    res.json(updated);
  })
);

module.exports = router;
