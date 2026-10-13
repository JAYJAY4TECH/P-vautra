const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Referral = require('../models/Referral');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const referrals = await Referral.find({ referrer: req.user._id })
    .populate('referee', 'fullName email createdAt')
    .sort({ createdAt: -1 });
  // Prefer Vercel forwarded headers, fall back to Express defaults
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
  const baseUrl = proto + '://' + host;
  const referralUrl = `${baseUrl}/register.html?ref=${req.user.referralCode}`;

  res.json({
    referralCode: req.user.referralCode,
    referralUrl,
    referrals
  });
});

module.exports = router;