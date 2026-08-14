const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const groceryRepository = require('../repositories/grocery.repository');
const { validateGroceryBody } = require('../utils/validators');

const router = express.Router();

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
