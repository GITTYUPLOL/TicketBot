const express = require('express');
const router = express.Router();
const db = require('../db');
const {
  ingestLiveData,
  normalizeCategories,
  normalizeCountryCodes,
} = require('../services/liveIngestion');

function envNumber(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const DEFAULT_SYNC_TTL_MINUTES = envNumber('LIVE_SYNC_TTL_MINUTES', 30);
const DEFAULT_MAX_PAGES = envNumber('TICKETMASTER_MAX_PAGES', 12);
const DEFAULT_DAYS_AHEAD = envNumber('TICKETMASTER_DAYS_AHEAD', 60);

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function parseList(value) {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function buildIngestOptions(req) {
  const payload = req.body || {};
  const query = req.query || {};

  const providers = parseList(payload.providers || query.providers);
  const categories = normalizeCategories(payload.categories || query.categories);
  const countryCodes = normalizeCountryCodes(
    payload.country_codes
      || payload.country_code
      || query.country_codes
      || query.country_code
  );
  const segmentNames = parseList(
    payload.segment_names
      || payload.segment_name
      || query.segment_names
      || query.segment_name
  );

  return {
    providers: providers.length ? providers : undefined,
    categories,
    countryCodes,
    maxPages: toNumber(payload.max_pages || query.max_pages) || DEFAULT_MAX_PAGES,
    size: toNumber(payload.size || query.size),
    daysAhead: toNumber(payload.days_ahead || query.days_ahead) || DEFAULT_DAYS_AHEAD,
    keyword: payload.keyword || query.keyword,
    segmentNames,
    ticketmasterApiKey: payload.ticketmaster_api_key,
    seatgeekClientId: payload.seatgeek_client_id,
  };
}

function buildScopeKey(options) {
  const keyPayload = {
    providers: [...(options.providers || ['ticketmaster_discovery', 'ticketmaster_web'])].sort(),
    categories: [...(options.categories || [])].sort(),
    country_codes: [...(options.countryCodes || [])].sort(),
    segment_names: [...(options.segmentNames || [])].sort(),
    keyword: options.keyword || null,
    max_pages: options.maxPages || null,
    size: options.size || null,
    days_ahead: options.daysAhead || null,
  };

  return JSON.stringify(keyPayload);
}

function getLatestRun(environment, scopeKey) {
  return db.prepare(`
    SELECT id, status, completed_at, expires_at, summary_json
    FROM ingestion_runs
    WHERE environment = ? AND scope_key = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(environment, scopeKey);
}

function parseSummary(summaryJSON) {
  if (!summaryJSON) return null;
  try {
    return JSON.parse(summaryJSON);
  } catch {
    return null;
  }
}

function saveIngestionRun({ environment, scopeKey, status, ttlMinutes, summary, options }) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60000).toISOString();

  db.prepare(`
    INSERT INTO ingestion_runs (
      environment, scope_key, providers, status,
      started_at, completed_at, expires_at,
      fetched, normalized, inserted, updated, skipped, errors,
      summary_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    environment,
    scopeKey,
    JSON.stringify(options.providers || ['ticketmaster_discovery', 'ticketmaster_web']),
    status,
    summary.started_at || now.toISOString(),
    summary.completed_at || now.toISOString(),
    expiresAt,
    summary?.totals?.fetched || 0,
    summary?.totals?.normalized || 0,
    summary?.totals?.inserted || 0,
    summary?.totals?.updated || 0,
    summary?.totals?.skipped || 0,
    summary?.totals?.errors || 0,
    JSON.stringify(summary)
  );
}

function ensureLiveEnvironment(req, res) {
  const environment = db.getCurrentEnvironment();
  if (environment !== 'live') {
    res.status(400).json({
      error: 'Live ingestion is only available in LIVE environment',
      hint: 'Switch the UI toggle to LIVE and retry',
    });
    return false;
  }
  return true;
}

router.get('/providers', (_req, res) => {
  res.json({
    environment: db.getCurrentEnvironment(),
    recommended_sync: {
      ttl_minutes: DEFAULT_SYNC_TTL_MINUTES,
      days_ahead: DEFAULT_DAYS_AHEAD,
      max_pages: DEFAULT_MAX_PAGES,
    },
    providers: [
      {
        name: 'ticketmaster_discovery',
        configured: Boolean(process.env.TICKETMASTER_API_KEY),
        required_env: ['TICKETMASTER_API_KEY'],
        market_type: 'primary',
      },
      {
        name: 'ticketmaster_web',
        configured: true,
        required_env: [],
        market_type: 'primary',
        notes: ['Fallback source without API key; uses estimated prices'],
      },
      {
        name: 'seatgeek_resale',
        configured: Boolean(process.env.SEATGEEK_CLIENT_ID),
        required_env: ['SEATGEEK_CLIENT_ID'],
        market_type: 'resale',
        notes: ['Real resale market coverage when SeatGeek API client id is configured'],
      },
    ],
  });
});

router.post('/ingest', async (req, res) => {
  if (!ensureLiveEnvironment(req, res)) return;

  try {
    const options = buildIngestOptions(req);
    const summary = await ingestLiveData(options);
    const hasErrors = summary.totals.errors > 0;
    return res.status(hasErrors ? 207 : 200).json(summary);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Live ingestion failed' });
  }
});

router.post('/sync', async (req, res) => {
  if (!ensureLiveEnvironment(req, res)) return;

  const environment = db.getCurrentEnvironment();
  const payload = req.body || {};
  const query = req.query || {};
  const ttlMinutes = clamp(
    toNumber(payload.ttl_minutes || query.ttl_minutes) || DEFAULT_SYNC_TTL_MINUTES,
    5,
    1440
  );
  const force = toBoolean(payload.force || query.force);
  const options = buildIngestOptions(req);
  const scopeKey = buildScopeKey(options);

  try {
    if (!force) {
      const latest = getLatestRun(environment, scopeKey);
      if (latest?.completed_at) {
        const completedAtMs = Date.parse(latest.completed_at);
        if (Number.isFinite(completedAtMs)) {
          const ageMinutes = (Date.now() - completedAtMs) / 60000;
          if (ageMinutes <= ttlMinutes && ['success', 'partial'].includes(latest.status)) {
            return res.json({
              cached: true,
              scope_key: scopeKey,
              ttl_minutes: ttlMinutes,
              cache_age_minutes: Math.max(0, Math.round(ageMinutes)),
              next_refresh_in_minutes: Math.max(0, Math.round(ttlMinutes - ageMinutes)),
              summary: parseSummary(latest.summary_json),
            });
          }
        }
      }
    }

    const summary = await ingestLiveData(options);
    const status = summary.totals.errors > 0 ? 'partial' : 'success';
    saveIngestionRun({ environment, scopeKey, status, ttlMinutes, summary, options });

    return res.status(status === 'success' ? 200 : 207).json({
      cached: false,
      scope_key: scopeKey,
      ttl_minutes: ttlMinutes,
      ...summary,
    });
  } catch (error) {
    return res.status(500).json({
      cached: false,
      scope_key: scopeKey,
      error: error.message || 'Live sync failed',
    });
  }
});

module.exports = router;
