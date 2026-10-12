const express = require('express');
const router = express.Router();
const Routine = require('../models/Routine');
const Exercise = require('../models/Exercise');

// Shared by create and edit.
// body: { name, items: [{ exerciseId, sets, superset }] }
async function validate(body, userId) {
  const { name, items } = body;
  if (!name || !name.trim()) return { error: 'Routine name is required' };
  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'Pick at least one exercise for the routine' };
  }

  // Every superset id must be used by exactly two items.
  const counts = {};
  items.forEach((i) => {
    if (i.superset != null) counts[i.superset] = (counts[i.superset] || 0) + 1;
  });
  if (Object.values(counts).some((c) => c !== 2)) {
    return { error: 'A superset must contain exactly two exercises' };
  }

  const ids = [...new Set(items.map((i) => i.exerciseId))];
  const owned = await Exercise.countDocuments({ _id: { $in: ids }, user: userId });
  if (owned !== ids.length) return { error: 'One or more exercises were not found' };

  return {
    name: name.trim(),
    items: items.map((i) => ({
      exercise: i.exerciseId,
      sets: Math.min(20, Math.max(1, Number(i.sets) || 3)),
      superset: i.superset == null ? null : Number(i.superset)
    }))
  };
}

function handleError(err, res) {
  if (err.code === 11000) {
    return res.status(409).json({ error: 'A routine with that name already exists' });
  }
  res.status(500).json({ error: err.message });
}

// GET /api/routines
router.get('/', async (req, res) => {
  try {
    const routines = await Routine.find({ user: req.userId })
      .populate('items.exercise')
      .sort({ name: 1 });
    res.json(routines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/routines
router.post('/', async (req, res) => {
  try {
    const v = await validate(req.body, req.userId);
    if (v.error) return res.status(400).json({ error: v.error });

    const routine = await Routine.create({ user: req.userId, name: v.name, items: v.items });
    res.status(201).json(await routine.populate('items.exercise'));
  } catch (err) {
    handleError(err, res);
  }
});

// PUT /api/routines/:id - replace name + items
router.put('/:id', async (req, res) => {
  try {
    const v = await validate(req.body, req.userId);
    if (v.error) return res.status(400).json({ error: v.error });

    const routine = await Routine.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { name: v.name, items: v.items },
      { new: true, runValidators: true }
    );
    if (!routine) return res.status(404).json({ error: 'Routine not found' });
    res.json(await routine.populate('items.exercise'));
  } catch (err) {
    handleError(err, res);
  }
});

// DELETE /api/routines/:id
router.delete('/:id', async (req, res) => {
  try {
    await Routine.findOneAndDelete({ _id: req.params.id, user: req.userId });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
