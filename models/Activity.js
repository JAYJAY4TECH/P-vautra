const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    enum: ['signup', 'login', 'logout', 'plan_join', 'plan_leave',
           'referral', 'settings', 'demo'],
    required: true
  },
  message: { type: String, required: true },
  meta: { type: Object, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('Activity', activitySchema);