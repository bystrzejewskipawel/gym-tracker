const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
    sets: { type: Number, default: 3, min: 1, max: 20 },
    // Items sharing the same non-null number form a superset (exactly two items).
    superset: { type: Number, default: null }
  },
  { _id: false }
);

const routineSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  items: { type: [itemSchema], default: [] },
  createdAt: { type: Date, default: Date.now }
});

routineSchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Routine', routineSchema);
