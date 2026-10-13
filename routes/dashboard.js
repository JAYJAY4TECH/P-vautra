const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const Referral = require('../models/Referral');
const Plan = require('../models/Plan');
const User = require('../models/User');
const csrfCheck = require('../middleware/csrf');

const router = express.Router();
router.use(requireAuth);

// GET /api/dashboard — overview bundle
router.get('/', async (req, res) => {
  const [activities, notifications, referrals, plans] = await Promise.all([
    Activity.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(10),
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(5),
    Referral.find({ referrer: req.user._id }).populate('referee', 'fullName email createdAt'),
    Plan.find({ enabled: true }).sort({ order: 1 }).limit(3)
  ]);

  const populated = await req.user.populate('activePlan');

  res.json({
    user: populated.toSafeJSON(),
    activities,
    notifications,
    referralCount: referrals.length,
    referralRewards: referrals
      .filter(r => r.status === 'rewarded')
      .reduce((s, r) => s + (r.rewardAmount || 0), 0),
    topPlans: plans
  });
});

// GET /api/dashboard/activity
router.get('/activity', async (req, res) => {
  const activities = await Activity.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100);
  res.json({ activities });
});

// GET /api/dashboard/notifications
router.get('/notifications', async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ notifications });
});

// POST /api/dashboard/notifications/:id/read
router.post('/notifications/:id/read', csrfCheck, async (req, res) => {
  await Notification.updateOne(
    { _id: req.params.id, user: req.user._id },
    { $set: { read: true } }
  );
  res.json({ ok: true });
});

// GET /api/dashboard/profile
router.get('/profile', (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

// POST /api/dashboard/profile
router.post('/profile', csrfCheck, async (req, res) => {
  try {
    const { fullName } = req.body;
    if (fullName && fullName.trim().length >= 2) {
      req.user.fullName = fullName.trim();
      await req.user.save();
      await Activity.create({
        user: req.user._id, type: 'settings', message: 'Profile updated'
      });
    }
    res.json({ user: req.user.toSafeJSON() });
  } catch (err) {
    console.error('[dashboard/profile]', err);
    res.status(500).json({ error: 'Could not save profile.' });
  }
});

// POST /api/dashboard/deposit — records a deposit intent
// NOTE: Real money movement requires a payment processor (Stripe/Paystack).
// Until that is wired, this endpoint records the user's intent and creates
// an Activity entry. No funds are credited automatically.
router.post('/deposit', csrfCheck, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Enter a valid amount greater than 0.' });
    }
    if (amount > 1000000) {
      return res.status(400).json({ error: 'Amount exceeds the maximum for a single deposit.' });
    }

    await Activity.create({
      user: req.user._id,
      type: 'plan_join',
      message: `Initiated deposit of $${amount.toFixed(2)}`,
      meta: { amount, status: 'pending' }
    });

    await Notification.create({
      user: req.user._id,
      title: 'Deposit initiated',
      body: `Your deposit of $${amount.toFixed(2)} is pending processing.`,
      kind: 'info'
    });

    res.json({
      ok: true,
      message: `Deposit of $${amount.toFixed(2)} initiated. You will receive a confirmation once funds clear.`,
      amount
    });
  } catch (err) {
    console.error('[dashboard/deposit]', err);
    res.status(500).json({ error: 'Could not process deposit.' });
  }
});

// POST /api/dashboard/withdraw — records a withdrawal intent
router.post('/withdraw', csrfCheck, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Enter a valid amount greater than 0.' });
    }
    if (amount > (req.user.balance || 0)) {
      return res.status(400).json({ error: 'Amount exceeds your available balance.' });
    }

    await Activity.create({
      user: req.user._id,
      type: 'plan_leave',
      message: `Initiated withdrawal of $${amount.toFixed(2)}`,
      meta: { amount, status: 'pending' }
    });

    await Notification.create({
      user: req.user._id,
      title: 'Withdrawal initiated',
      body: `Your withdrawal of $${amount.toFixed(2)} is being processed.`,
      kind: 'warning'
    });

    res.json({
      ok: true,
      message: `Withdrawal of $${amount.toFixed(2)} initiated. Funds arrive in 1–2 business days.`,
      amount
    });
  } catch (err) {
    console.error('[dashboard/withdraw]', err);
    res.status(500).json({ error: 'Could not process withdrawal.' });
  }
});

module.exports = router;