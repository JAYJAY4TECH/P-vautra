const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Plan = require('../models/Plan');
const Activity = require('../models/Activity');
const User = require('../models/User');
const csrfCheck = require('../middleware/csrf');

const router = express.Router();

router.get('/', async (req, res) => {
  const plans = await Plan.find({ enabled: true }).sort({ order: 1 });
  res.json({ plans });
});

// Open a vault — assigns the plan to the user's account
router.post('/:slug/join', requireAuth, csrfCheck, async (req, res) => {
  const plan = await Plan.findOne({ slug: req.params.slug, enabled: true });
  if (!plan) return res.status(404).json({ error: 'Vault not found' });

  req.user.activePlan = plan._id;
  await req.user.save();

  await Activity.create({
    user: req.user._id,
    type: 'plan_join',
    message: `Opened ${plan.name} vault`
  });

  res.json({
    ok: true,
    message: `You opened the ${plan.name} vault. Add funds to start saving.`,
    plan
  });
});

module.exports = router;