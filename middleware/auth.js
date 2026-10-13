const User = require('../models/User');

async function attachUser(req, res, next) {
  try {
    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId);
      if (user && user.status === 'active') {
        req.user = user;
      } else {
        // Stale session — destroy it
        req.session.destroy(() => {});
      }
    }
    next();
  } catch (err) {
    console.error('[auth] attachUser', err);
    next();
  }
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

function requireGuest(req, res, next) {
  // Only block API requests — never redirect browser navigations
  if (req.user && req.originalUrl.startsWith('/api/')) {
    return res.status(400).json({ error: 'Already signed in' });
  }
  next();
}

module.exports = { attachUser, requireAuth, requireGuest };