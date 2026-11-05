const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  amountUsd: { type: Number, required: true, min: 0 },
  coin: { type: String, enum: ["BTC", "ETH", "SOL", "USDT"], required: true },
  walletAddress: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "paid"],
    default: "pending",
    index: true
  },
  requestedAt: { type: Date, default: Date.now },
  reviewedAt: Date,
  paidAt: Date,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewNote: { type: String, default: "" },
  txHash: { type: String, default: null }
}, { timestamps: true });

withdrawalSchema.methods.toClientJSON = function () {
  return {
    id: this._id,
    amountUsd: this.amountUsd,
    coin: this.coin,
    walletAddress: this.walletAddress,
    status: this.status,
    requestedAt: this.requestedAt,
    reviewedAt: this.reviewedAt,
    paidAt: this.paidAt,
    txHash: this.txHash
  };
};

module.exports = mongoose.model("Withdrawal", withdrawalSchema);