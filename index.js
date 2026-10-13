require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const csrf = require('csrf');

const connectDB = require('./config/database');
const { attachUser } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

connectDB(process.env.MONGO_URI);

// ---------- Security ----------
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));

// ---------- Parsers ----------
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ---------- No-cache for HTML in development ----------
app.use((req, res, next) => {
  const isHtml =
    req.path === '/' ||
    req.path.endsWith('.html') ||
    !path.extname(req.path);

  if (isHtml && process.env.NODE_ENV !== 'production') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  next();
});

// ---------- Static files ----------
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  etag: process.env.NODE_ENV === 'production',
  lastModified: true
}));

// ---------- Sessions ----------
// No maxAge here — the login handler decides per-user based on "remember me"
app.use(session({
  name: 'vaultra.sid',
  secret: process.env.SESSION_SECRET || 'dev_only_change_me',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60, // DB cleanup after 14 days max
    autoRemove: 'native'
  }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  },
  proxy: true
}));

// ---------- CSRF ----------
const tokens = new csrf();
app.use((req, res, next) => {
  if (!req.session.csrfSecret) {
    req.session.csrfSecret = tokens.secretSync();
  }
  const token = tokens.create(req.session.csrfSecret);
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  });
  res.locals.csrfToken = token;
  req.csrfTokens = tokens;
  next();
});

// ================================================================
// TEMPORARY — Session killer. Remove after login works.
// ================================================================
app.get('/__kill-session', (req, res) => {
  const sid = req.sessionID;
  req.session.destroy((err) => {
    if (err) {
      console.error('[kill-session]', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
    res.clearCookie('vaultra.sid', { path: '/' });
    res.clearCookie('XSRF-TOKEN', { path: '/' });
    res.json({ ok: true, message: 'Session killed', sid });
  });
});
// ================================================================

// ---------- Rate limiters ----------
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in 15 minutes.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ---------- Attach user ----------
app.use(attachUser);

// ---------- Routes ----------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/vaults', require('./routes/vaults'));
app.use('/api/referrals', require('./routes/referrals'));
app.use('/api/deposit', require('./routes/deposit'));
app.use('/api/admin', require('./routes/admin'));

// ---------- 404 ----------
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// ---------- Errors ----------
app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Something went wrong.' });
});

// ---------- Export + listen ----------
module.exports = app;

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`[server] Vaultra running at http://localhost:${PORT}`);
  });
}