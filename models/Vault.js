const mongoose = require('mongoose');

const vaultSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  coin: { type: String, enum: ['BTC', 'ETH', 'SOL', 'USDT'], required: true },
  principalUsd: { type: Number, required: true, min: 0 },       // deposited value in USD
  apyPercent: { type: Number, required: true, min: 0 },         // e.g. 8.5 for 8.5%
  durationDays: { type: Number, required: true, min: 1 },
  startedAt: { type: Date, default: Date.now },
  maturesAt: { type: Date, required: true },
  accruedUsd: { type: Number, default: 0 },                     // total earned so far
  status: {
    type: String,
    enum: ['active', 'matured', 'cancelled'],
    default: 'active',
    index: true
  },
  lastAccrualAt: { type: Date, default: Date.now },
  cancelledAt: Date,
  maturedAt: Date,
  depositTxHash: { type: String, default: null },
  notes: { type: String, default: '' }
}, { timestamps: true });

vaultSchema.virtual('daysElapsed').get(function () {
  const ms = Date.now() - this.startedAt.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
});

vaultSchema.virtual('daysRemaining').get(function () {
  const ms = this.maturesAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
});

vaultSchema.methods.toClientJSON = function () {
  return {
    id: this._id,
    coin: this.coin,
    planName: this.plan && this.plan.name ? this.plan.name : '',
    principalUsd: this.principalUsd,
    apyPercent: this.apyPercent,
    durationDays: this.durationDays,
    startedAt: this.startedAt,
    maturesAt: this.maturesAt,
    accruedUsd: this.accruedUsd,
    status: this.status,
    daysElapsed: this.daysElapsed,
    daysRemaining: this.daysRemaining,
    projectedTotalUsd: this.principalUsd + (this.principalUsd * this.apyPercent / 100) * (this.durationDays / 365),
    depositTxHash: this.depositTxHash
  };
};

module.exports = mongoose.model('Vault', vaultSchema);