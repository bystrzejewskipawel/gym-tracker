const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const Exercise = require('../models/Exercise');

// GET /api/sessions - list this user's sessions, most recent first
router.get('/', async (req, res) => {
  try {
    const sessions = await Session.find({ user: req.userId }).sort({ date: -1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:id - single session
router.get('/:id', async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, user: req.userId });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions - create a new workout session
// body: { date, notes, exercises: [{ exerciseId, sets: [{reps, weight}] }] }
router.post('/', async (req, res) => {
  try {
    const { date, notes, exercises } = req.body;
    if (!Array.isArray(exercises) || exercises.length === 0) {
      return res.status(400).json({ error: 'A session needs at least one exercise' });
    }

    const resolvedExercises = [];
    for (const ex of exercises) {
      const exerciseDoc = await Exercise.findOne({ _id: ex.exerciseId, user: req.userId });
      if (!exerciseDoc) {
        return res.status(400).json({ error: `Exercise ${ex.exerciseId} not found` });
      }
      resolvedExercises.push({
        exercise: exerciseDoc._id,
        exerciseName: exerciseDoc.name,
        sets: (ex.sets || []).map((s) => ({ reps: Number(s.reps), weight: Number(s.weight) }))
      });
    }

    const session = await Session.create({
      user: req.userId,
      date: date ? new Date(date) : new Date(),
      notes: notes || '',
      exercises: resolvedExercises
    });

    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sessions/:id
router.delete('/:id', async (req, res) => {
  try {
    await Session.findOneAndDelete({ _id: req.params.id, user: req.userId });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
