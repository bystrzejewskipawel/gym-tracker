const mongoose = require('mongoose');

// A single set: reps, weight (kg) and, for one-sided exercises, which side.
const setSchema = new mongoose.Schema(
  {
    reps: { type: Number, required: true, min: 0 },
    weight: { type: Number, required: true, min: 0 },
    side: { type: String, enum: ['L', 'R'] }
  },
  { _id: false }
);

// One exercise performed within a session, with all its completed sets.
const sessionExerciseSchema = new mongoose.Schema(
  {
    exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
    exerciseName: { type: String, required: true }, // snapshot, survives renames
    durationSeconds: { type: Number, default: 0, min: 0 }, // time spent on this exercise
    sets: { type: [setSchema], default: [] }
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, default: Date.now },
  notes: { type: String, default: '' },
  exercises: { type: [sessionExerciseSchema], default: [] }
});

module.exports = mongoose.model('Session', sessionSchema);
