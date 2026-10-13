function requireAdmin(req, res, next) {
  // Pass if: admin-role user OR session unlocked with password
  if (req.session && req.session.adminUnlocked === true) return next();
  if (req.user && req.user.role === "admin") return next();
  return res.status(403).json({ error: "Admin access required", locked: true });
}

module.exports = { requireAdmin };