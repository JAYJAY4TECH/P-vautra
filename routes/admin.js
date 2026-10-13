const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const User = require('../models/User');
const Plan = require('../models/Plan');
const Activity = require('../models/Activity');
const Referral = require('../models/Referral');
const csrfCheck = require('../middleware/csrf');

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  const filter = q
    ? { $or: [
        { email: new RegExp(q, 'i') },
        { fullName: new RegExp(q, 'i') }
      ] }
    : {};

  const [users, plans, referralCount, userCount, recentActivity] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).limit(50),
    Plan.find().sort({ order: 1 }),
    Referral.countDocuments(),
    User.countDocuments(),
    Activity.find().sort({ createdAt: -1 }).limit(20).populate('user', 'email')
  ]);

  res.json({
    stats: { userCount, planCount: plans.length, referralCount },
    users: users.map(u => u.toSafeJSON()),
    plans,
    recentActivity
  });
});

router.post('/plans', csrfCheck, async (req, res) => {
  try {
    const {
      name, slug, description, minAmount, maxAmount,
      durationDays, feePercent, riskLevel, terms, enabled
    } = req.body;

    if (!name || !slug) return res.status(400).json({ error: 'Name and slug required.' });

    const plan = await Plan.findOneAndUpdate(
      { slug },
      {
        name, slug, description,
        minAmount: Number(minAmount),
        maxAmount: Number(maxAmount),
        durationDays: Number(durationDays),
        feePercent: Number(feePercent || 0),
        riskLevel: riskLevel || 'medium',
        terms: terms || '',
        enabled: !!enabled
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ plan });
  } catch (err) {
    console.error('[admin/plans]', err);
    res.status(500).json({ error: 'Could not save plan.' });
  }
});

router.post('/plans/:id/toggle', csrfCheck, async (req, res) => {
  const plan = await Plan.findById(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  plan.enabled = !plan.enabled;
  await plan.save();
  res.json({ plan });
});

module.exports = router;