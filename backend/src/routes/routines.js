const express = require('express');
const router = express.Router();
const Routine = require('../models/Routine');

// GET /api/routines - list this user's saved routines, with exercise details populated
router.get('/', async (req, res) => {
  try {
    const routines = await Routine.find({ user: req.userId })
      .populate('exercises')
      .sort({ name: 1 });
    res.json(routines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/routines - create a new routine, e.g. { name: "Push Day", exerciseIds: [...] }
router.post('/', async (req, res) => {
  try {
    const { name, exerciseIds } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Routine name is required' });
    }
    if (!Array.isArray(exerciseIds) || exerciseIds.length === 0) {
      return res.status(400).json({ error: 'Pick at least one exercise for the routine' });
    }

    const routine = await Routine.create({
      user: req.userId,
      name: name.trim(),
      exercises: exerciseIds
    });
    const populated = await routine.populate('exercises');
    res.status(201).json(populated);
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
