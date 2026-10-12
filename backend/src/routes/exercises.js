const express = require('express');
const router = express.Router();
const Exercise = require('../models/Exercise');
const Session = require('../models/Session');

function parseRest(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(1800, Math.max(0, Math.round(n))) : undefined;
}

// GET /api/exercises
router.get('/', async (req, res) => {
  try {
    const exercises = await Exercise.find({ user: req.userId }).sort({ name: 1 });
    res.json(exercises);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/exercises
router.post('/', async (req, res) => {
  try {
    const { name, category, restSeconds, asymmetrical } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Exercise name is required' });
    }
    const exercise = await Exercise.create({
      user: req.userId,
      name: name.trim(),
      category: category?.trim() || 'General',
      restSeconds: parseRest(restSeconds) ?? 180,
      asymmetrical: !!asymmetrical
    });
    res.status(201).json(exercise);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An exercise with that name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/exercises/:id - edit name / rest time / asymmetry / category
router.patch('/:id', async (req, res) => {
  try {
    const updates = {};
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ error: 'Exercise name is required' });
      updates.name = name;
    }
    if (req.body.restSeconds !== undefined) {
      const rest = parseRest(req.body.restSeconds);
      if (rest === undefined) return res.status(400).json({ error: 'Invalid rest time' });
      updates.restSeconds = rest;
    }
    if (req.body.asymmetrical !== undefined) updates.asymmetrical = !!req.body.asymmetrical;
    if (req.body.category !== undefined) updates.category = String(req.body.category).trim() || 'General';

    const exercise = await Exercise.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      updates,
      { new: true, runValidators: true }
    );
    if (!exercise) return res.status(404).json({ error: 'Exercise not found' });
    res.json(exercise);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An exercise with that name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/exercises/:id
router.delete('/:id', async (req, res) => {
  try {
    await Exercise.findOneAndDelete({ _id: req.params.id, user: req.userId });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/exercises/:id/history?limit=N - past results, newest first.
// Powers "last time", the prefilled values and the progress chart.
router.get('/:id/history', async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const sessions = await Session.find({
      user: req.userId,
      'exercises.exercise': req.params.id
    })
      .sort({ date: -1 })
      .limit(limit);

    const history = sessions.map((session) => {
      const entry = session.exercises.find((e) => e.exercise.toString() === req.params.id);
      return {
        sessionId: session._id,
        date: session.date,
        durationSeconds: entry ? entry.durationSeconds : 0,
        sets: entry ? entry.sets : []
      };
    });

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
