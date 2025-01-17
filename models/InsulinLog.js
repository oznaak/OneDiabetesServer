const mongoose = require('mongoose');

const insulinLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  units: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['IOB', 'COB'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const InsulinLog = mongoose.model('InsulinLog', insulinLogSchema);
module.exports = InsulinLog;