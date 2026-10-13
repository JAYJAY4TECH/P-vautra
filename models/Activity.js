const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: {
    type: String,
    enum: ["signup", "login", "logout", "plan_join", "plan_leave",
           "referral", "settings", "demo", "deposit", "withdrawal", "admin_credit"],
    required: true
  },
  message: { type: String, required: true },
  meta: { type: Object, default: {} },
  amountUsd: { type: Number, default: 0 },
  coin: { type: String, default: null },
  txHash: { type: String, default: null },
  vaultId: { type: mongoose.Schema.Types.ObjectId, ref: "Vault", default: null },
  status: {
    type: String,
    enum: ["pending", "completed", "rejected", null],
    default: null,
    index: true
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewedAt: Date,
  reviewNote: { type: String, default: "" }
}, { timestamps: true });

module.exports = mongoose.model("Activity", activitySchema);