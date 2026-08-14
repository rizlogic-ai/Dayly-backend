const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const groceryRepository = require('../repositories/grocery.repository');
const { isFiniteNumber, isBoolean } = require('../utils/validators');

const router = express.Router();

// `requireName`: true for POST (name is mandatory), false for PUT (name
// is one of several optionally-patched fields) — everything else here is
// "if present, must be the right type," never mandatory on either verb.
function validateGroceryBody(body, { requireName }) {
  if (requireName && (typeof body.name !== 'string' || body.name.trim() === '')) {
    return 'name is required.';
  }
  if (body.name !== undefined && typeof body.name !== 'string') {
    return 'name must be a string.';
  }
  if (body.quantity !== undefined && body.quantity !== null && !isFiniteNumber(body.quantity)) {
    return 'quantity must be a number.';
  }
  if (body.unit !== undefined && body.unit !== null && typeof body.unit !== 'string') {
    return 'unit must be a string.';
  }
  if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') {
    return 'note must be a string.';
  }
  if (body.checked !== undefined && !isBoolean(body.checked)) {
    return 'checked must be a boolean.';
  }
  return null;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await groceryRepository.getAllForUser(req.user.id));
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const error = validateGroceryBody(req.body, { requireName: true });
    if (error) return res.status(400).json({ error });

    const item = await groceryRepository.create(req.user.id, req.body);
    res.status(201).json(item);
  })
);

// Bulk-clear before the /:id route so "checked" can't be parsed as an id.
router.delete(
  '/checked',
  asyncHandler(async (req, res) => {
    const removed = await groceryRepository.clearChecked(req.user.id);
    res.json({ removed });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const error = validateGroceryBody(req.body, { requireName: false });
    if (error) return res.status(400).json({ error });

    const updated = await groceryRepository.update(req.user.id, req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Grocery item not found.' });
    res.json(updated);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const removed = await groceryRepository.remove(req.user.id, req.params.id);
    if (!removed) return res.status(404).json({ error: 'Grocery item not found.' });
    res.status(204).end();
  })
);

module.exports = router;
