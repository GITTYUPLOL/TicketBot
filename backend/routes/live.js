const express = require('express');
const router = express.Router();
const db = require('../db');
const { ingestLiveData } = require('../services/liveIngestion');

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

router.get('/providers', (_req, res) => {
  res.json({
    environment: db.getCurrentEnvironment(),
    providers: [
      {
        name: 'ticketmaster_discovery',
        configured: Boolean(process.env.TICKETMASTER_API_KEY),
        required_env: ['TICKETMASTER_API_KEY'],
      },
      {
        name: 'ticketmaster_web',
        configured: true,
        required_env: [],
        notes: ['Fallback source without API key; uses estimated prices'],
      },
    ],
  });
});

router.post('/ingest', async (req, res) => {
  const environment = db.getCurrentEnvironment();
  if (environment !== 'live') {
    return res.status(400).json({
      error: 'Live ingestion is only available in LIVE environment',
      hint: 'Switch the UI toggle to LIVE and retry',
    });
  }

  try {
    const payload = req.body || {};
    const summary = await ingestLiveData({
      providers: payload.providers,
      countryCode: payload.country_code || req.query.country_code,
      maxPages: toNumber(payload.max_pages || req.query.max_pages),
      size: toNumber(payload.size || req.query.size),
      daysAhead: toNumber(payload.days_ahead || req.query.days_ahead),
      keyword: payload.keyword || req.query.keyword,
      segmentName: payload.segment_name || req.query.segment_name,
      ticketmasterApiKey: payload.ticketmaster_api_key,
    });

    const hasErrors = summary.totals.errors > 0;
    return res.status(hasErrors ? 207 : 200).json(summary);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Live ingestion failed' });
  }
});

module.exports = router;
