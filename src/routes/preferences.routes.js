const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const preferencesRepository = require('../repositories/preferences.repository');
const { isBoolean } = require('../utils/validators');
const { MODULE_TYPES } = require('../constants/moduleTypes');

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

    if (onboardingComplete !== undefined && !isBoolean(onboardingComplete)) {
      return res.status(400).json({ error: 'onboardingComplete must be a boolean.' });
    }
    if (enabledModules !== undefined) {
      if (!Array.isArray(enabledModules) || enabledModules.some((m) => !MODULE_TYPES.includes(m))) {
        return res.status(400).json({ error: `enabledModules must be an array of: ${MODULE_TYPES.join(', ')}.` });
      }
    }
    if (homeLocation !== undefined && homeLocation !== null && typeof homeLocation !== 'string') {
      return res.status(400).json({ error: 'homeLocation must be a string or null.' });
    }
    if (
      prayerCalculationParams !== undefined &&
      prayerCalculationParams !== null &&
      typeof prayerCalculationParams !== 'object'
    ) {
      return res.status(400).json({ error: 'prayerCalculationParams must be an object or null.' });
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
