const pool = require('../config/db');

function toDomain(row) {
  return {
    userId: row.user_id,
    onboardingComplete: row.onboarding_complete,
    enabledModules: row.enabled_modules,
    homeLocation: row.home_location,
    prayerCalculationParams: row.prayer_calculation_params,
    updatedAt: row.updated_at,
  };
}

const DEFAULTS = {
  onboardingComplete: false,
  enabledModules: [],
  homeLocation: null,
  prayerCalculationParams: null,
};

// Preferences are 1:1 with a user and always exist once fetched — the
// first GET for a brand-new user creates the default row rather than
// returning 404, so the client never needs a separate "initialize
// preferences" call.
async function getOrCreate(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM dayly.user_preferences WHERE user_id = $1',
    [userId]
  );
  if (rows[0]) return toDomain(rows[0]);

  const inserted = await pool.query(
    `INSERT INTO dayly.user_preferences (user_id, onboarding_complete, enabled_modules, home_location, prayer_calculation_params)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING *`,
    [
      userId,
      DEFAULTS.onboardingComplete,
      JSON.stringify(DEFAULTS.enabledModules),
      DEFAULTS.homeLocation,
      DEFAULTS.prayerCalculationParams,
    ]
  );
  return toDomain(inserted.rows[0]);
}

// Partial update: only fields present in `patch` are touched, so a client
// can flip just `onboardingComplete` without resending the whole record.
async function update(userId, patch) {
  await getOrCreate(userId);

  const fields = [];
  const values = [];
  let i = 1;

  if ('onboardingComplete' in patch) {
    fields.push(`onboarding_complete = $${i++}`);
    values.push(patch.onboardingComplete);
  }
  if ('enabledModules' in patch) {
    fields.push(`enabled_modules = $${i++}`);
    values.push(JSON.stringify(patch.enabledModules));
  }
  if ('homeLocation' in patch) {
    fields.push(`home_location = $${i++}`);
    values.push(patch.homeLocation);
  }
  if ('prayerCalculationParams' in patch) {
    fields.push(`prayer_calculation_params = $${i++}`);
    values.push(JSON.stringify(patch.prayerCalculationParams));
  }

  if (fields.length === 0) return getOrCreate(userId);

  fields.push('updated_at = now()');
  values.push(userId);

  const { rows } = await pool.query(
    `UPDATE dayly.user_preferences SET ${fields.join(', ')} WHERE user_id = $${i} RETURNING *`,
    values
  );
  return toDomain(rows[0]);
}

module.exports = { getOrCreate, update };
