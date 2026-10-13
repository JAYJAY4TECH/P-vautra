const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const csrfCheck = require('../middleware/csrf');

const router = express.Router();

// GET /api/deposit/addresses — public config (safe: addresses only, no keys)
router.get('/addresses', (req, res) => {
  res.json({
    btc:  process.env.CRYPTO_BTC_ADDRESS  || '',
    eth:  process.env.CRYPTO_ETH_ADDRESS  || '',
    sol:  process.env.CRYPTO_SOL_ADDRESS  || '',
    usdt: process.env.CRYPTO_USDT_TRC20_ADDRESS || ''
  });
});

// POST /api/deposit/intent — user says "I sent crypto"
router.post('/intent', requireAuth, csrfCheck, async (req, res) => {
  try {
    const { coin, amount, txHash } = req.body;

    const allowed = ['BTC', 'ETH', 'SOL', 'USDT'];
    if (!allowed.includes(coin)) {
      return res.status(400).json({ error: 'Unsupported coin.' });
    }
    if (amount !== undefined && (isNaN(amount) || Number(amount) < 0)) {
      return res.status(400).json({ error: 'Invalid amount.' });
    }
    if (txHash && !/^[a-zA-Z0-9]{32,128}$/.test(txHash)) {
      return res.status(400).json({ error: 'Invalid transaction hash.' });
    }

    await Activity.create({
      user: req.user._id,
      type: 'plan_join',
      message: `Declared ${coin} deposit of ${amount || 'unspecified'} — pending verification`,
      meta: { coin, amount: Number(amount) || 0, txHash: txHash || null, status: 'pending_verification' }
    });

    await Notification.create({
      user: req.user._id,
      title: `${coin} deposit under review`,
      body: 'Your deposit will be credited after on-chain confirmation.',
      kind: 'info'
    });

    res.json({
      ok: true,
      message: 'Deposit recorded. Your balance will update after on-chain confirmation.'
    });
  } catch (err) {
    console.error('[deposit/intent]', err);
    res.status(500).json({ error: 'Could not record deposit.' });
  }
});

module.exports = router;