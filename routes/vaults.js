const express = require('express');
const { requireAuth } = require('../middleware/auth');
const csrfCheck = require('../middleware/csrf');
const Plan = require('../models/Plan');
const Vault = require('../models/Vault');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');

const router = express.Router();

// ---------- Accrual math ----------
// Simple daily interest on principal; USD-denominated for accounting.
function accrue(vault, now) {
  if (vault.status !== 'active') return;
  const last = vault.lastAccrualAt.getTime();
  const ms = now.getTime() - last;
  const days = ms / (1000 * 60 * 60 * 24);
  if (days <= 0) return;
  const dailyRate = vault.apyPercent / 100 / 365;
  const earned = vault.principalUsd * dailyRate * days;
  vault.accruedUsd = (vault.accruedUsd || 0) + earned;
  vault.lastAccrualAt = now;
  if (now >= vault.maturesAt) {
    vault.status = 'matured';
    vault.maturedAt = now;
  }
}

// ---------- List tiers (public) ----------
router.get('/tiers', async (req, res) => {
  const tiers = await Plan.find({ enabled: true }).sort({ tier: 1 });
  res.json({ tiers });
});

// ---------- List user's vaults ----------
router.get('/', requireAuth, async (req, res) => {
  const vaults = await Vault.find({ user: req.user._id })
    .populate('plan')
    .sort({ createdAt: -1 });

  // Run accrual on each before returning
  const now = new Date();
  for (const v of vaults) {
    if (v.status === 'active') {
      accrue(v, now);
      await v.save();
    }
  }

  const totalPrincipal = vaults.reduce((s, v) => s + (v.principalUsd || 0), 0);
  const totalAccrued = vaults.reduce((s, v) => s + (v.accruedUsd || 0), 0);

  res.json({
    vaults: vaults.map(v => v.toClientJSON()),
    totals: {
      principalUsd: Number(totalPrincipal.toFixed(2)),
      accruedUsd: Number(totalAccrued.toFixed(2))
    }
  });
});

// ---------- Open a new vault ----------
router.post('/open', requireAuth, csrfCheck, async (req, res) => {
  try {
    const { planId, coin, principalUsd, depositTxHash } = req.body;

    // Validate coin
    const allowed = ['BTC', 'ETH', 'SOL', 'USDT'];
    if (!allowed.includes(coin)) {
      return res.status(400).json({ error: 'Unsupported coin.' });
    }

    // Validate principal
    const amount = Number(principalUsd);
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Enter a valid deposit amount.' });
    }

    // Load tier
    const plan = await Plan.findById(planId);
    if (!plan || !plan.enabled) {
      return res.status(404).json({ error: 'Vault tier not found or disabled.' });
    }
    if (amount < plan.minAmount) {
      return res.status(400).json({ error: `Minimum for ${plan.name} is $${plan.minAmount}.` });
    }
    if (amount > plan.maxAmount) {
      return res.status(400).json({ error: `Maximum for ${plan.name} is $${plan.maxAmount}.` });
    }

    const startedAt = new Date();
    const maturesAt = new Date(startedAt.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    const vault = await Vault.create({
      user: req.user._id,
      plan: plan._id,
      coin,
      principalUsd: amount,
      apyPercent: plan.apyPercent,
      durationDays: plan.durationDays,
      startedAt,
      maturesAt,
      lastAccrualAt: startedAt,
      depositTxHash: depositTxHash || null
    });

    await Activity.create({
      user: req.user._id,
      type: 'plan_join',
      message: `Opened ${plan.name} vault with $${amount} in ${coin}`,
      meta: { vaultId: vault._id, plan: plan.slug, coin, amount }
    });

    await Notification.create({
      user: req.user._id,
      title: 'Vault opened',
      body: `Your ${plan.name} vault is active. It matures in ${plan.durationDays} days.`,
      kind: 'success'
    });

    const populated = await vault.populate('plan');
    res.status(201).json({ vault: populated.toClientJSON() });
  } catch (err) {
    console.error('[vaults/open]', err);
    res.status(500).json({ error: 'Could not open vault.' });
  }
});

// ---------- Cancel a vault early ----------
router.post('/:id/cancel', requireAuth, csrfCheck, async (req, res) => {
  try {
    const vault = await Vault.findOne({ _id: req.params.id, user: req.user._id }).populate('plan');
    if (!vault) return res.status(404).json({ error: 'Vault not found.' });
    if (vault.status !== 'active') {
      return res.status(400).json({ error: 'This vault is not active.' });
    }

    const now = new Date();
    accrue(vault, now);
    vault.status = 'cancelled';
    vault.cancelledAt = now;
    await vault.save();

    await Activity.create({
      user: req.user._id,
      type: 'plan_leave',
      message: `Cancelled ${vault.plan.name} vault. Accrued: $${vault.accruedUsd.toFixed(2)}`,
      meta: { vaultId: vault._id, accrued: vault.accruedUsd }
    });

    res.json({
      ok: true,
      message: `Vault cancelled. Earned $${vault.accruedUsd.toFixed(2)}. Funds return in 1-2 business days.`,
      vault: vault.toClientJSON()
    });
  } catch (err) {
    console.error('[vaults/cancel]', err);
    res.status(500).json({ error: 'Could not cancel vault.' });
  }
});

module.exports = router;