module.exports = function csrfCheck(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const token = req.body._csrf || req.headers['x-csrf-token'];
  if (!token || !req.csrfTokens.verify(req.session.csrfSecret, token)) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
};