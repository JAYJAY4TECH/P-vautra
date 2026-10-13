const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 80 },
  email: {
    type: String, required: true, unique: true,
    lowercase: true, trim: true, index: true
  },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  referralCode: {
    type: String, unique: true, index: true,
    default: () => crypto.randomBytes(4).toString("hex").toUpperCase()
  },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  balance: { type: Number, default: 0 },
  activePlan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", default: null },
  status: { type: String, enum: ["active", "suspended"], default: "active" },
  lastLoginAt: Date,

  // Password reset
  resetCode: { type: String, default: null },
  resetCodeExpiresAt: { type: Date, default: null },
  resetAttempts: { type: Number, default: 0 }
}, { timestamps: true });

userSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, 12);
};

userSchema.methods.verifyPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    fullName: this.fullName,
    email: this.email,
    role: this.role,
    referralCode: this.referralCode,
    balance: this.balance,
    activePlan: this.activePlan,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model("User", userSchema);