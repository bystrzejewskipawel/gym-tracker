const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Session = require('../models/Session');
const Exercise = require('../models/Exercise');

// Validates and normalises the `exercises` array of a session payload.
// allowMissing (used when editing): an exercise that has since been deleted keeps
// the name already stored on the session instead of failing the whole edit.
async function resolveExercises(exercises, userId, allowMissing) {
  if (!Array.isArray(exercises) || exercises.length === 0) {
    return { error: 'A session needs at least one exercise' };
  }

  const resolved = [];
  for (const ex of exercises) {
    if (!mongoose.isValidObjectId(ex.exerciseId)) return { error: 'Invalid exercise' };

    const doc = await Exercise.findOne({ _id: ex.exerciseId, user: userId });
    const name = doc ? doc.name : allowMissing ? ex.exerciseName : null;
    if (!name) return { error: `Exercise ${ex.exerciseId} not found` };

    const sets = (ex.sets || []).map((s) => ({
      reps: Number(s.reps),
      weight: Number(s.weight) || 0,
      side: s.side === 'L' || s.side === 'R' ? s.side : undefined
    }));
    if (sets.some((s) => !Number.isFinite(s.reps) || s.reps < 0 || s.weight < 0)) {
      return { error: 'Reps and weight must be valid, non-negative numbers' };
    }

    resolved.push({
      exercise: ex.exerciseId,
      exerciseName: name,
      durationSeconds: Math.max(0, Math.round(Number(ex.durationSeconds) || 0)),
      sets
    });
  }
  return { resolved };
}

// GET /api/sessions - list this user's sessions, most recent first
router.get('/', async (req, res) => {
  try {
    const sessions = await Session.find({ user: req.userId }).sort({ date: -1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:id
router.get('/:id', async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, user: req.userId });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions
// body: { date, notes, exercises: [{ exerciseId, durationSeconds, sets: [{reps, weight, side}] }] }
router.post('/', async (req, res) => {
  try {
    const { date, notes, exercises } = req.body;
    const { resolved, error } = await resolveExercises(exercises, req.userId, false);
    if (error) return res.status(400).json({ error });

    const session = await Session.create({
      user: req.userId,
      date: date ? new Date(date) : new Date(),
      notes: notes || '',
      exercises: resolved
    });
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sessions/:id - edit a logged session (date, notes, exercises, sets, durations)
router.put('/:id', async (req, res) => {
  try {
    const { date, notes, exercises } = req.body;

    const session = await Session.findOne({ _id: req.params.id, user: req.userId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const { resolved, error } = await resolveExercises(exercises, req.userId, true);
    if (error) return res.status(400).json({ error });

    if (date) {
      const parsed = new Date(date);
      if (Number.isNaN(parsed.getTime())) return res.status(400).json({ error: 'Invalid date' });
      session.date = parsed;
    }
    session.notes = notes || '';
    session.exercises = resolved;
    await session.save();

    res.json(session);
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
