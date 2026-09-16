const express = require('express');
const router = express.Router();
const Exercise = require('../models/Exercise');
const Session = require('../models/Session');

// GET /api/exercises - list this user's exercises
router.get('/', async (req, res) => {
  try {
    const exercises = await Exercise.find({ user: req.userId }).sort({ name: 1 });
    res.json(exercises);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/exercises - manually add a new exercise
router.post('/', async (req, res) => {
  try {
    const { name, category } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Exercise name is required' });
    }
    const exercise = await Exercise.create({
      user: req.userId,
      name: name.trim(),
      category: category?.trim() || 'General'
    });
    res.status(201).json(exercise);
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

// GET /api/exercises/:id/history - all past sets logged for this exercise,
// most recent session first. This is what powers "last time you did X"
// and feeds the progress chart.
router.get('/:id/history', async (req, res) => {
  try {
    const sessions = await Session.find({
      user: req.userId,
      'exercises.exercise': req.params.id
    })
      .sort({ date: -1 })
      .limit(50);

    const history = sessions.map((session) => {
      const entry = session.exercises.find(
        (e) => e.exercise.toString() === req.params.id
      );
      return {
        sessionId: session._id,
        date: session.date,
        sets: entry ? entry.sets : []
      };
    });

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
