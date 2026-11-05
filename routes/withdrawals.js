const express = require("express");
const { requireAuth } = require("../middleware/auth");
const csrfCheck = require("../middleware/csrf");
const User = require("../models/User");
const Withdrawal = require("../models/Withdrawal");
const Activity = require("../models/Activity");
const Notification = require("../models/Notification");

const router = express.Router();
router.use(requireAuth);

// Helper: is the user eligible to withdraw?
function getEligibility(user) {
  const lastDeposit = user.lastApprovedDepositAt;
  if (!lastDeposit) {
    return { eligible: false, reason: "Make your first deposit to unlock withdrawals." };
  }
  const daysSince = (Date.now() - new Date(lastDeposit).getTime()) / (1000 * 60 * 60 * 24);
  const daysLeft = Math.max(0, 30 - daysSince);
  if (daysLeft > 0) {
    return { eligible: false, reason: "Withdrawal unlocks in " + Math.ceil(daysLeft) + " day(s).", daysLeft: Math.ceil(daysLeft) };
  }
  const available = Math.max(0, (user.balance || 0) - (user.withdrawnUsd || 0));
  if (available <= 0) {
    return { eligible: false, reason: "No balance available to withdraw." };
  }
  return { eligible: true, availableUsd: available, daysLeft: 0 };
}

// GET /api/withdrawals/eligibility
router.get("/eligibility", async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const eligibility = getEligibility(user);
    res.json(eligibility);
  } catch (err) {
    console.error("[withdrawals/eligibility]", err);
    res.status(500).json({ error: "Could not check eligibility." });
  }
});

// GET /api/withdrawals — user withdrawal history
router.get("/", async (req, res) => {
  try {
    const list = await Withdrawal.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
    res.json({ withdrawals: list.map(w => w.toClientJSON()) });
  } catch (err) {
    console.error("[withdrawals/list]", err);
    res.status(500).json({ error: "Could not load withdrawals." });
  }
});

// POST /api/withdrawals — request a withdrawal
router.post("/", csrfCheck, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const eligibility = getEligibility(user);

    if (!eligibility.eligible) {
      return res.status(400).json({ error: eligibility.reason });
    }

    const { coin, amountUsd, walletAddress } = req.body;
    const allowed = ["BTC", "ETH", "SOL", "USDT"];
    if (!allowed.includes(coin)) {
      return res.status(400).json({ error: "Unsupported coin." });
    }
    const amount = Number(amountUsd);
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Enter a valid amount." });
    }
    if (amount > eligibility.availableUsd) {
      return res.status(400).json({ error: "Amount exceeds your available balance ($" + eligibility.availableUsd.toFixed(2) + ")." });
    }
    if (!walletAddress || walletAddress.trim().length < 10) {
      return res.status(400).json({ error: "Enter a valid wallet address." });
    }

    // Check if user already has a pending withdrawal
    const pending = await Withdrawal.findOne({ user: req.user._id, status: "pending" });
    if (pending) {
      return res.status(400).json({ error: "You already have a pending withdrawal. Wait for admin review." });
    }

    const w = await Withdrawal.create({
      user: req.user._id,
      amountUsd: amount,
      coin,
      walletAddress: walletAddress.trim(),
      status: "pending"
    });

    await Activity.create({
      user: req.user._id,
      type: "withdrawal",
      message: "Withdrawal request: $" + amount.toFixed(2) + " in " + coin,
      amountUsd: amount,
      coin,
      status: "pending"
    });

    await Notification.create({
      user: req.user._id,
      title: "Withdrawal requested",
      body: "Your $" + amount.toFixed(2) + " " + coin + " withdrawal is pending admin review.",
      kind: "info"
    });

    res.status(201).json({ ok: true, withdrawal: w.toClientJSON() });
  } catch (err) {
    console.error("[withdrawals/create]", err);
    res.status(500).json({ error: "Could not create withdrawal." });
  }
});

module.exports = router;