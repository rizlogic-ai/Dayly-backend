const express = require('express');
const cors = require('cors');
const authenticate = require('./middleware/authenticate');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const preferencesRoutes = require('./routes/preferences.routes');
const activitiesRoutes = require('./routes/activities.routes');
const eventsRoutes = require('./routes/events.routes');
const groceryRoutes = require('./routes/grocery.routes');

const app = express();

app.use(cors());
app.use(express.json());

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
