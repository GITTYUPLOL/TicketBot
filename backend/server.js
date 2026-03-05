require('dotenv').config();

const express = require('express');
const cors = require('cors');
const seed = require('./data/seed');
const db = require('./db');
let sourcesRouter = null;

try {
  sourcesRouter = require('./routes/sources');
} catch {
  sourcesRouter = null;
}

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json());

// Seed database on startup
seed();

// Route every request to an isolated environment DB.
app.use((req, res, next) => {
  const requestedEnvironment = req.get('x-ticketbot-env') || req.query.env;
  const environment = db.normalizeEnvironment(requestedEnvironment);

  req.ticketbotEnv = environment;
  res.setHeader('X-Ticketbot-Env', environment);

  db.withEnvironment(environment, next);
});

// Routes
app.use('/api/events', require('./routes/events'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/autobuy', require('./routes/autobuy'));
app.use('/api/cards', require('./routes/cards'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/sniper', require('./routes/sniper'));
app.use('/api/readiness', require('./routes/readiness'));
app.use('/api/live', require('./routes/live'));
if (sourcesRouter) {
  app.use('/api/sources', sourcesRouter);
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: req.ticketbotEnv || db.getCurrentEnvironment(),
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, HOST, () => {
  console.log(`Ticketbot API running on http://${HOST}:${PORT}`);

  // Auto-fetch live data on startup (runs in background, doesn't block)
  setTimeout(() => {
    console.log('[DataAggregator] Starting background data refresh...');
    const { aggregateFromAllSources } = require('./services/dataAggregator');
    db.withEnvironment('test', async () => {
      try {
        const result = await aggregateFromAllSources({ daysAhead: 60, maxPages: 3 });
        console.log(`[DataAggregator] test env: ${result.totals.inserted} new, ${result.totals.updated} updated, ${result.totals.fetched} fetched from ${result.providers.length} sources`);
      } catch (err) {
        console.error('[DataAggregator] test env error:', err.message);
      }
    });
    db.withEnvironment('live', async () => {
      try {
        const result = await aggregateFromAllSources({ daysAhead: 60, maxPages: 3 });
        console.log(`[DataAggregator] live env: ${result.totals.inserted} new, ${result.totals.updated} updated, ${result.totals.fetched} fetched from ${result.providers.length} sources`);
      } catch (err) {
        console.error('[DataAggregator] live env error:', err.message);
      }
    });
  }, 2000);

  // Refresh every 30 minutes
  setInterval(() => {
    console.log('[DataAggregator] Scheduled refresh...');
    db.withEnvironment('test', async () => {
      try {
        const { aggregateFromAllSources } = require('./services/dataAggregator');
        await aggregateFromAllSources({ daysAhead: 60, maxPages: 2 });
      } catch (err) {
        console.error('[DataAggregator] scheduled refresh error:', err.message);
      }
    });
  }, 30 * 60 * 1000);
});
