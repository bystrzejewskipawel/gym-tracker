const express = require('express');
const router = express.Router();
const Routine = require('../models/Routine');
const Exercise = require('../models/Exercise');

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
// body: { name, items: [{ exerciseId, sets, superset }] }
router.post('/', async (req, res) => {
  try {
    const { name, items } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Routine name is required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Pick at least one exercise for the routine' });
    }

    // Every superset id must be used by exactly two items.
    const counts = {};
    items.forEach((i) => {
      if (i.superset != null) counts[i.superset] = (counts[i.superset] || 0) + 1;
    });
    if (Object.values(counts).some((c) => c !== 2)) {
      return res.status(400).json({ error: 'A superset must contain exactly two exercises' });
    }

    const ids = [...new Set(items.map((i) => i.exerciseId))];
    const owned = await Exercise.countDocuments({ _id: { $in: ids }, user: req.userId });
    if (owned !== ids.length) {
      return res.status(400).json({ error: 'One or more exercises were not found' });
    }

    const routine = await Routine.create({
      user: req.userId,
      name: name.trim(),
      items: items.map((i) => ({
        exercise: i.exerciseId,
        sets: Math.min(20, Math.max(1, Number(i.sets) || 3)),
        superset: i.superset == null ? null : Number(i.superset)
      }))
    });
    res.status(201).json(await routine.populate('items.exercise'));
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'A routine with that name already exists' });
    }
    res.status(500).json({ error: err.message });
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
