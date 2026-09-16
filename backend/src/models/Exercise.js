const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, default: 'General', trim: true },
  createdAt: { type: Date, default: Date.now }
});

// Exercise names must be unique per user, not globally.
exerciseSchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Exercise', exerciseSchema);
