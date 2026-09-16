const mongoose = require('mongoose');

// A single set: how many reps, at what weight (kg).
const setSchema = new mongoose.Schema(
  {
    reps: { type: Number, required: true, min: 0 },
    weight: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

// One exercise performed within a session, with all its sets.
const sessionExerciseSchema = new mongoose.Schema(
  {
    exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
    exerciseName: { type: String, required: true }, // denormalized snapshot, survives exercise renames
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
