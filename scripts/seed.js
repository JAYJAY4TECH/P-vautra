require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');
const Plan = require('../models/Plan');

(async () => {
  await connectDB(process.env.MONGO_URI);

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@vaultra.local').toLowerCase();
  const adminPass = process.env.ADMIN_PASSWORD || 'ChangeMe123!';

  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = new User({ fullName: 'Vaultra Admin', email: adminEmail, role: 'admin' });
    await admin.setPassword(adminPass);
    await admin.save();
    console.log('[seed] Admin created:', adminEmail);
  } else {
    console.log('[seed] Admin already exists');
  }

  const tiers = [
    {
      name: 'Starter Vault',
      slug: 'starter',
      tier: 1,
      description: 'Low-minimum entry tier. Best for first-time savers.',
      minAmount: 10,
      maxAmount: 500,
      durationDays: 30,
      apyPercent: 5.5,
      feePercent: 0.5,
      riskLevel: 'low',
      terms: 'Projected yield based on a simple-interest model. Not guaranteed. Rates subject to change.',
      enabled: true,
      order: 1
    },
    {
      name: 'Growth Vault',
      slug: 'growth',
      tier: 2,
      description: 'Balanced tier for steady savers.',
      minAmount: 500,
      maxAmount: 5000,
      durationDays: 60,
      apyPercent: 9.5,
      feePercent: 1.0,
      riskLevel: 'medium',
      terms: 'Projected yield based on a simple-interest model. Not guaranteed. Rates subject to change.',
      enabled: true,
      order: 2
    },
    {
      name: 'Prime Vault',
      slug: 'prime',
      tier: 3,
      description: 'Highest tier for committed investors.',
      minAmount: 5000,
      maxAmount: 50000,
      durationDays: 90,
      apyPercent: 14.0,
      feePercent: 1.5,
      riskLevel: 'high',
      terms: 'Projected yield based on a simple-interest model. Not guaranteed. Rates subject to change.',
      enabled: true,
      order: 3
    }
  ];

  for (const t of tiers) {
    await Plan.findOneAndUpdate({ slug: t.slug }, t, { upsert: true, new: true });
  }
  console.log('[seed] Tiers upserted:', tiers.length);

  await mongoose.disconnect();
  process.exit(0);
})();