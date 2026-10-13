const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Activity = require('../models/Activity');
const Referral = require('../models/Referral');
const Notification = require('../models/Notification');
const { requireGuest } = require('../middleware/auth');
const csrfCheck = require('../middleware/csrf');

const router = express.Router();

// ---------- CSRF token endpoint ----------
router.get('/csrf', (req, res) => {
  res.json({ csrfToken: res.locals.csrfToken });
});

// ---------- Current user ----------
router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ user: null });
  res.json({ user: req.user.toSafeJSON() });
});

// ---------- Register ----------
router.post(
  '/register',
  requireGuest,
  csrfCheck,
  [
    body('fullName').trim().isLength({ min: 2, max: 80 }).withMessage('Full name is required.'),
    body('email').isEmail().withMessage('Valid email required.').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
    body('confirmPassword').custom((v, { req }) => v === req.body.password)
      .withMessage('Passwords do not match.')
  ],
  async (req, res) => {
    const errors = validationResult(req).array();
    if (errors.length) {
      return res.status(400).json({ error: errors[0].msg, errors: errors.map(e => e.msg) });
    }

    const { fullName, email, password, ref, remember } = req.body;

    try {
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(400).json({ error: 'An account with that email already exists.' });
      }

      const user = new User({ fullName, email });
      await user.setPassword(password);

      if (ref) {
        const referrer = await User.findOne({ referralCode: String(ref).toUpperCase() });
        if (referrer) user.referredBy = referrer._id;
      }

      await user.save();

      if (user.referredBy) {
        await Referral.create({
          referrer: user.referredBy,
          referee: user._id,
          status: 'pending'
        });
        await Notification.create({
          user: user.referredBy,
          title: 'New referral signup',
          body: `${user.fullName} joined using your code.`,
          kind: 'info'
        });
      }

      await Activity.create({ user: user._id, type: 'signup', message: 'Account created' });

      // ---------- Session setup ----------
      req.session.userId = user._id.toString();
      applyRememberMe(req, remember);

      req.session.save((err) => {
        if (err) {
          console.error('[auth/register] session save', err);
          return res.status(500).json({ error: 'Session error. Please try again.' });
        }
        res.status(201).json({ user: user.toSafeJSON() });
      });
    } catch (err) {
      console.error('[auth/register]', err);
      res.status(500).json({ error: 'Server error. Please try again.' });
    }
  }
);

// ---------- Login ----------
router.post(
  '/login',
  csrfCheck,
  [
    body('email').isEmail().withMessage('Valid email required.').normalizeEmail(),
    body('password').isLength({ min: 1 }).withMessage('Password required.')
  ],
  async (req, res) => {
    const errors = validationResult(req).array();
    if (errors.length) {
      return res.status(400).json({ error: errors[0].msg });
    }

    const { email, password, remember } = req.body;

    try {
      const user = await User.findOne({ email });

      if (!user || !(await user.verifyPassword(password))) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      if (user.status !== 'active') {
        return res.status(403).json({ error: 'This account is suspended.' });
      }

      user.lastLoginAt = new Date();
      await user.save();
      await Activity.create({ user: user._id, type: 'login', message: 'Signed in' });

      // Handle case where user is already logged in as someone else
      if (req.session.userId && req.session.userId !== user._id.toString()) {
        req.session.regenerate((regenErr) => {
          if (regenErr) {
            console.error('[auth/login] regenerate', regenErr);
            return res.status(500).json({ error: 'Session error. Please try again.' });
          }
          finishLogin(req, res, user, remember);
        });
        return;
      }

      finishLogin(req, res, user, remember);
    } catch (err) {
      console.error('[auth/login]', err);
      res.status(500).json({ error: 'Server error. Please try again.' });
    }
  }
);

// Helper: set session + remember-me cookie, then save and respond
function finishLogin(req, res, user, remember) {
  req.session.userId = user._id.toString();
  applyRememberMe(req, remember);

  req.session.save((err) => {
    if (err) {
      console.error('[auth/login] save', err);
      return res.status(500).json({ error: 'Session error. Please try again.' });
    }
    res.json({ user: user.toSafeJSON() });
  });
}

// Helper: apply or clear remember-me based on checkbox
function applyRememberMe(req, remember) {
  const wantsRemember =
    remember === true ||
    remember === 'true' ||
    remember === 'on' ||
    remember === '1' ||
    remember === 1;

  if (wantsRemember) {
    req.session.cookie.maxAge = 14 * 24 * 60 * 60 * 1000; // 14 days
  } else {
    // Session cookie — expires when browser closes
    req.session.cookie.expires = false;
    req.session.cookie.maxAge = null;
  }
}

// ---------- Logout ----------
// ---------- Forgot password ----------
router.post(
  '/forgot-password',
  csrfCheck,
  [body('email').isEmail().withMessage('Valid email required.').normalizeEmail()],
  async (req, res) => {
    const errors = validationResult(req).array();
    if (errors.length) return res.status(400).json({ error: errors[0].msg });

    const email = req.body.email;
    try {
      const user = await User.findOne({ email });

      // Always respond OK even if user doesn't exist (avoids email enumeration)
      if (!user) {
        return res.json({ ok: true, message: 'If that email exists, a code has been sent.' });
      }

      // Generate 6-digit code
      const code = String(Math.floor(100000 + Math.random() * 900000));

      user.resetCode = code;
      user.resetCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min
      user.resetAttempts = 0;
      await user.save();

      const subject = 'Vaultra password reset code';
      const textBody =
        'Your Vaultra password reset code is: ' + code + '\n\n' +
        'This code expires in 15 minutes. If you did not request this, ignore this email.';
      const htmlBody =
        '<p>Your Vaultra password reset code is:</p>' +
        '<h2 style="letter-spacing:4px;">' + code + '</h2>' +
        '<p>This code expires in 15 minutes. If you did not request this, ignore this email.</p>';

      const { sendMail } = require('../config/mailer');
      const result = await sendMail(user.email, subject, textBody, htmlBody);

      if (!result.ok) {
        return res.status(500).json({ error: 'Could not send email. Try again later.' });
      }

      res.json({ ok: true, message: 'Code sent. Check your email.' });
    } catch (err) {
      console.error('[auth/forgot-password]', err);
      res.status(500).json({ error: 'Server error. Please try again.' });
    }
  }
);

// ---------- Reset password ----------
router.post(
  '/reset-password',
  csrfCheck,
  [
    body('email').isEmail().withMessage('Valid email required.').normalizeEmail(),
    body('code').trim().isLength({ min: 6, max: 6 }).withMessage('Enter the 6-digit code.'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters.')
  ],
  async (req, res) => {
    const errors = validationResult(req).array();
    if (errors.length) return res.status(400).json({ error: errors[0].msg });

    const { email, code, newPassword } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user || !user.resetCode) {
        return res.status(400).json({ error: 'Invalid or expired code.' });
      }

      if (user.resetCodeExpiresAt && user.resetCodeExpiresAt.getTime() < Date.now()) {
        user.resetCode = null;
        user.resetCodeExpiresAt = null;
        await user.save();
        return res.status(400).json({ error: 'Code expired. Request a new one.' });
      }

      if ((user.resetAttempts || 0) >= 5) {
        return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
      }

      if (user.resetCode !== code) {
        user.resetAttempts = (user.resetAttempts || 0) + 1;
        await user.save();
        return res.status(400).json({ error: 'Wrong code.' });
      }

      // Correct code - reset password
      await user.setPassword(newPassword);
      user.resetCode = null;
      user.resetCodeExpiresAt = null;
      user.resetAttempts = 0;
      await user.save();

      await Activity.create({
        user: user._id,
        type: 'settings',
        message: 'Password reset via email code'
      });

      res.json({ ok: true, message: 'Password reset. You can now sign in.' });
    } catch (err) {
      console.error('[auth/reset-password]', err);
      res.status(500).json({ error: 'Server error. Please try again.' });
    }
  }
);
router.post('/logout', csrfCheck, async (req, res) => {
  const uid = req.session.userId;

  req.session.destroy(async (err) => {
    if (err) {
      console.error('[auth/logout]', err);
      return res.status(500).json({ error: 'Could not log out. Try again.' });
    }

    res.clearCookie('vaultra.sid', { path: '/' });
    res.clearCookie('XSRF-TOKEN', { path: '/' });

    if (uid) {
      try {
        await Activity.create({ user: uid, type: 'logout', message: 'Signed out' });
      } catch (_) {}
    }

    res.json({ ok: true });
  });
});

module.exports = router;  