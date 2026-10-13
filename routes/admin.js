const express = require("express");
const rateLimit = require("express-rate-limit");
const { requireAdmin } = require("../middleware/admin");
const csrfCheck = require("../middleware/csrf");
const User = require("../models/User");
const Plan = require("../models/Plan");
const Activity = require("../models/Activity");
const Referral = require("../models/Referral");
const Vault = require("../models/Vault");
const Notification = require("../models/Notification");

const router = express.Router();

const unlockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in 15 minutes." }
});

router.post("/unlock", unlockLimiter, (req, res) => {
  const password = process.env.ADMIN_PANEL_PASSWORD;
  if (!password) return res.status(500).json({ error: "Admin panel not configured" });
  if (req.body && req.body.password === password) {
    req.session.adminUnlocked = true;
    req.session.adminExpiresAt = Date.now() + 60 * 60 * 1000;
    req.session.save(function () { res.json({ ok: true }); });
    return;
  }
  return res.status(401).json({ error: "Wrong password" });
});

router.post("/lock", (req, res) => {
  if (req.session) {
    req.session.adminUnlocked = false;
    req.session.adminExpiresAt = null;
  }
  req.session.save(function () { res.json({ ok: true }); });
});

router.get("/status", (req, res) => {
  var unlocked = req.session && req.session.adminUnlocked === true;
  var notExpired = req.session && req.session.adminExpiresAt && Date.now() < req.session.adminExpiresAt;
  res.json({ unlocked: !!(unlocked && notExpired) });
});

router.use(requireAdmin);

router.get("/", async (req, res) => {
  const q = (req.query.q || "").trim();
  const filter = q
    ? { $or: [{ email: new RegExp(q, "i") }, { fullName: new RegExp(q, "i") }] }
    : {};

  const results = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).limit(50),
    Plan.find().sort({ tier: 1 }),
    Referral.countDocuments(),
    User.countDocuments(),
    Activity.find({ type: "deposit", status: "pending" }).populate("user", "fullName email").sort({ createdAt: -1 }),
    Vault.countDocuments({ status: "active" }),
    Activity.find().sort({ createdAt: -1 }).limit(30).populate("user", "email")
  ]);

  res.json({
    stats: {
      userCount: results[3],
      planCount: results[1].length,
      referralCount: results[2],
      activeVaults: results[5],
      pendingDeposits: results[4].length
    },
    users: results[0].map(u => u.toSafeJSON()),
    plans: results[1],
    pendingDeposits: results[4],
    recentActivity: results[6]
  });
});

router.post("/deposits/:id/approve", csrfCheck, async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id);
    if (!activity) return res.status(404).json({ error: "Deposit not found." });
    if (activity.status !== "pending") return res.status(400).json({ error: "Already reviewed." });

    const user = await User.findById(activity.user);
    if (!user) return res.status(404).json({ error: "User not found." });

    const amount = activity.amountUsd || 0;
    user.balance = (user.balance || 0) + amount;
    await user.save();

    if (activity.vaultId) {
      const vault = await Vault.findById(activity.vaultId);
      if (vault && vault.status === "active") {
        vault.principalUsd = (vault.principalUsd || 0) + amount;
        await vault.save();
      }
    }

    activity.status = "completed";
    activity.reviewedAt = new Date();
    activity.reviewNote = req.body.note || "Approved by admin";
    activity.message = "Deposit of $" + amount.toFixed(2) + " credited";
    await activity.save();

    await Activity.create({
      user: user._id,
      type: "admin_credit",
      message: "Admin credited $" + amount.toFixed(2),
      amountUsd: amount,
      status: "completed",
      reviewedAt: new Date()
    });

    await Notification.create({
      user: user._id,
      title: "Deposit confirmed",
      body: "Your deposit of $" + amount.toFixed(2) + " has been credited to your balance.",
      kind: "success"
    });

    res.json({ ok: true, message: "Deposit approved and balance updated." });
  } catch (err) {
    console.error("[admin/deposits/approve]", err);
    res.status(500).json({ error: "Could not approve deposit." });
  }
});

router.post("/deposits/:id/reject", csrfCheck, async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id);
    if (!activity) return res.status(404).json({ error: "Deposit not found." });
    if (activity.status !== "pending") return res.status(400).json({ error: "Already reviewed." });

    activity.status = "rejected";
    activity.reviewedAt = new Date();
    activity.reviewNote = req.body.note || "Rejected by admin";
    activity.message = "Deposit rejected";
    await activity.save();

    await Notification.create({
      user: activity.user,
      title: "Deposit not confirmed",
      body: "We could not verify this deposit. Contact support if you sent funds.",
      kind: "warning"
    });

    res.json({ ok: true, message: "Deposit rejected." });
  } catch (err) {
    console.error("[admin/deposits/reject]", err);
    res.status(500).json({ error: "Could not reject deposit." });
  }
});

router.post("/users/:id/credit", csrfCheck, async (req, res) => {
  try {
    const amt = Number(req.body.amount);
    if (!amt || isNaN(amt)) return res.status(400).json({ error: "Enter a valid amount." });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });

    user.balance = (user.balance || 0) + amt;
    if (user.balance < 0) user.balance = 0;
    await user.save();

    await Activity.create({
      user: user._id,
      type: "admin_credit",
      message: "Admin " + (amt >= 0 ? "credited" : "debited") + " $" + Math.abs(amt).toFixed(2),
      amountUsd: amt,
      status: "completed",
      reviewedAt: new Date(),
      reviewNote: req.body.note || ""
    });

    await Notification.create({
      user: user._id,
      title: amt >= 0 ? "Balance updated" : "Balance adjusted",
      body: "Your balance was " + (amt >= 0 ? "credited" : "debited") + " by $" + Math.abs(amt).toFixed(2) + ".",
      kind: amt >= 0 ? "success" : "warning"
    });

    res.json({ ok: true, user: user.toSafeJSON() });
  } catch (err) {
    console.error("[admin/users/credit]", err);
    res.status(500).json({ error: "Could not adjust balance." });
  }
});

router.post("/plans/:id/toggle", csrfCheck, async (req, res) => {
  const plan = await Plan.findById(req.params.id);
  if (!plan) return res.status(404).json({ error: "Plan not found." });
  plan.enabled = !plan.enabled;
  await plan.save();
  res.json({ plan: plan });
});

module.exports = router;