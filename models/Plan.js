const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  description: { type: String, default: '' },
  minAmount: { type: Number, required: true, min: 0 },
  maxAmount: { type: Number, required: true, min: 0 },
  durationDays: { type: Number, required: true, min: 1 },
  feePercent: { type: Number, default: 0, min: 0, max: 100 },
  riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  terms: { type: String, default: '' },
  enabled: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Plan', planSchema);