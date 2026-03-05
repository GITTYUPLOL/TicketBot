const express = require('express');
const router = express.Router();
const db = require('../db');
const { aggregateFromAllSources } = require('../services/dataAggregator');

// Track last refresh per environment
const lastRefresh = {};

// GET /api/sources/status - show data source status
router.get('/status', (_req, res) => {
  const env = db.getCurrentEnvironment();
  const eventCount = db.prepare('SELECT COUNT(*) as c FROM events').get().c;
  const historyCount = db.prepare('SELECT COUNT(*) as c FROM price_history').get().c;
  const sources = db.prepare('SELECT COUNT(DISTINCT CASE WHEN image_url LIKE \'%ticketmaster%\' THEN \'ticketmaster\' WHEN image_url LIKE \'%seatgeek%\' THEN \'seatgeek\' ELSE \'seed\' END) as c FROM events').get().c;

  // Get distinct sources from recent data
  const recentEvents = db.prepare('SELECT created_at FROM events ORDER BY created_at DESC LIMIT 1').get();

  res.json({
    environment: env,
    event_count: eventCount,
    price_history_points: historyCount,
    last_refresh: lastRefresh[env] || null,
    last_event_update: recentEvents?.created_at || null,
    providers: {
      ticketmaster: { configured: Boolean(process.env.TICKETMASTER_API_KEY), key_prefix: process.env.TICKETMASTER_API_KEY?.slice(0, 4) || null },
      seatgeek: { configured: Boolean(process.env.SEATGEEK_CLIENT_ID), note: 'Works without key for basic queries' },
      bandsintown: { configured: true, note: 'Public API, no key needed' },
    },
  });
});

// POST /api/sources/refresh - pull fresh data from all sources
router.post('/refresh', async (req, res) => {
  const env = db.getCurrentEnvironment();
  if (env !== 'live') {
    return res.status(400).json({
      error: 'Real source refresh is only available in LIVE environment',
      hint: 'Switch the UI toggle to LIVE and retry',
    });
  }

  try {
    const payload = req.body || {};
    const result = await aggregateFromAllSources({
      providers: payload.providers,
      daysAhead: payload.days_ahead || 60,
      maxPages: payload.max_pages || 5,
      ticketmasterApiKey: payload.ticketmaster_api_key || process.env.TICKETMASTER_API_KEY,
      seatgeekClientId: payload.seatgeek_client_id || process.env.SEATGEEK_CLIENT_ID,
      countryCode: payload.country_code || process.env.TICKETMASTER_COUNTRY_CODE,
    });

    lastRefresh[db.getCurrentEnvironment()] = new Date().toISOString();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Data refresh failed' });
  }
});

module.exports = router;
