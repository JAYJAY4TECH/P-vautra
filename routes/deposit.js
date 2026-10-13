const express = require("express");
const { requireAuth } = require("../middleware/auth");
const Activity = require("../models/Activity");
const Notification = require("../models/Notification");
const csrfCheck = require("../middleware/csrf");

const router = express.Router();

router.get("/addresses", (req, res) => {
  res.json({
    btc:  process.env.CRYPTO_BTC_ADDRESS || "",
    eth:  process.env.CRYPTO_ETH_ADDRESS || "",
    sol:  process.env.CRYPTO_SOL_ADDRESS || "",
    usdt: process.env.CRYPTO_USDT_TRC20_ADDRESS || ""
  });
});

router.post("/intent", requireAuth, csrfCheck, async (req, res) => {
  try {
    const { coin, amount, txHash } = req.body;
    const allowed = ["BTC", "ETH", "SOL", "USDT"];
    if (!allowed.includes(coin)) {
      return res.status(400).json({ error: "Unsupported coin." });
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      return res.status(400).json({ error: "Enter a valid USD amount." });
    }
    if (txHash && !/^[a-zA-Z0-9]{32,128}$/.test(txHash)) {
      return res.status(400).json({ error: "Invalid transaction hash format." });
    }

    const activity = await Activity.create({
      user: req.user._id,
      type: "deposit",
      message: "Deposit request: $" + amt.toFixed(2) + " in " + coin + " - awaiting admin verification",
      amountUsd: amt,
      coin: coin,
      txHash: txHash || null,
      status: "pending",
      meta: { source: "user_intent" }
    });

    await Notification.create({
      user: req.user._id,
      title: "Deposit pending review",
      body: "We received your $" + amt.toFixed(2) + " " + coin + " deposit. It will be credited once confirmed.",
      kind: "info"
    });

    res.json({
      ok: true,
      activityId: activity._id,
      message: "Deposit submitted. You will be credited once we confirm the transaction."
    });
  } catch (err) {
    console.error("[deposit/intent]", err);
    res.status(500).json({ error: "Could not record deposit." });
  }
});

router.get("/history", requireAuth, async (req, res) => {
  const list = await Activity.find({
    user: req.user._id,
    type: "deposit"
  }).sort({ createdAt: -1 }).limit(100);

  res.json({ deposits: list });
});

module.exports = router;