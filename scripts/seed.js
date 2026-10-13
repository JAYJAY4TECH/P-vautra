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

  const plans = [
    { name: 'Starter', slug: 'starter', description: 'Low-minimum entry tier.',
      minAmount: 50, maxAmount: 500, durationDays: 30, feePercent: 1,
      riskLevel: 'low', terms: 'Demo only. No real funds accepted.', order: 1 },
    { name: 'Growth',  slug: 'growth',  description: 'Balanced tier.',
      minAmount: 500, maxAmount: 5000, durationDays: 60, feePercent: 1.5,
      riskLevel: 'medium', terms: 'Demo only. No real funds accepted.', order: 2 },
    { name: 'Prime',   slug: 'prime',   description: 'Higher-tier access.',
      minAmount: 5000, maxAmount: 50000, durationDays: 90, feePercent: 2,
      riskLevel: 'high', terms: 'Demo only. No real funds accepted.', order: 3 }
  ];

  for (const p of plans) {
    await Plan.findOneAndUpdate({ slug: p.slug }, p, { upsert: true, new: true });
  }
  console.log('[seed] Plans upserted:', plans.length);

  await mongoose.disconnect();
  process.exit(0);
})();