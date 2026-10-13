function requireAdmin(req, res, next) {
  var isAdminRole = req.user && req.user.role === "admin";
  var unlocked = req.session && req.session.adminUnlocked === true;
  var notExpired = req.session && req.session.adminExpiresAt && Date.now() < req.session.adminExpiresAt;

  if (isAdminRole || (unlocked && notExpired)) return next();

  if (req.session && unlocked && !notExpired) {
    req.session.adminUnlocked = false;
  }

  return res.status(403).json({ error: "Admin access required", locked: true });
}

module.exports = { requireAdmin };