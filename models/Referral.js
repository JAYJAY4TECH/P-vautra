const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referrer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  referee:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  status:   { type: String, enum: ['pending', 'qualified', 'rewarded'], default: 'pending' },
  rewardAmount: { type: Number, default: 0 },
  qualifiedAt: Date,
  rewardedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Referral', referralSchema);