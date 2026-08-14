const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const authenticate = require('./middleware/authenticate');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');

const authRoutes = require('./routes/auth.routes');
const preferencesRoutes = require('./routes/preferences.routes');
const activitiesRoutes = require('./routes/activities.routes');
const eventsRoutes = require('./routes/events.routes');
const groceryRoutes = require('./routes/grocery.routes');

const app = express();

// `cors()` with `env.corsOrigins` undefined allows any origin — see
// env.js's comment on why that's an acceptable default while every
// client is a mobile app authenticating with a Bearer header, not a
// cookie. Passing `undefined` for `origin` is equivalent to omitting
// the option entirely, so this stays a no-op until CORS_ORIGIN is set.
app.use(cors({ origin: env.corsOrigins }));
app.use(helmet());
app.use(requestLogger);
app.use(express.json());

// One ceiling for the whole API rather than per-route tuning — this is
// a "stop a runaway/malicious client from hammering us" backstop, not a
// product-shaped rate limit, so a single generous number is enough for
// now. Doesn't cover /health on purpose: uptime checks shouldn't be able
// to exhaust a budget shared with real traffic.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// Unauthenticated — a load balancer / uptime check hits this, and it
// should never depend on Firebase or Postgres being reachable to answer.
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// `/api/auth/session` verifies the token itself (see auth.routes.js) and
// is the only route that runs `authenticate` a la carte; everything else
// under /api requires it up front.
app.use('/api/auth', authRoutes);

app.use('/api/preferences', authenticate, preferencesRoutes);
app.use('/api/activities', authenticate, activitiesRoutes);
app.use('/api/events', authenticate, eventsRoutes);
app.use('/api/grocery-items', authenticate, groceryRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
app.use(errorHandler);

module.exports = app;
