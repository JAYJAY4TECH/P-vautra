const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  tier: { type: Number, required: true, min: 1, max: 3, index: true },  // 1, 2, 3
  description: { type: String, default: '' },
  minAmount: { type: Number, required: true, min: 0 },
  maxAmount: { type: Number, required: true, min: 0 },
  durationDays: { type: Number, required: true, min: 1 },
  apyPercent: { type: Number, required: true, min: 0 },                 // annualized %
  feePercent: { type: Number, default: 0, min: 0, max: 100 },
  riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  terms: { type: String, default: '' },
  enabled: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Plan', planSchema);