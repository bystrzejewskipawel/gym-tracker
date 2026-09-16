const mongoose = require('mongoose');

const routineSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  exercises: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' }],
  createdAt: { type: Date, default: Date.now }
});

routineSchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Routine', routineSchema);
