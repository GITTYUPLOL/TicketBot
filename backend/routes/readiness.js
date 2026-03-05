const express = require('express');
const router = express.Router();
const db = require('../db');

const PLATFORMS = ['ticketmaster', 'stubhub', 'seatgeek', 'axs'];

// GET /api/readiness/:eventId - snipe readiness checklist for a single event
router.get('/:eventId', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.eventId);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  // Check accounts: do we have active accounts on any platform?
  const accountsByPlatform = {};
  let totalAccounts = 0;
  for (const p of PLATFORMS) {
    const count = db.prepare('SELECT COUNT(*) as c FROM accounts WHERE platform = ? AND status = ?').get(p, 'active')?.c || 0;
    accountsByPlatform[p] = count;
    totalAccounts += count;
  }

  // Check if an autobuy/snipe rule exists for this event
  const rules = db.prepare('SELECT id, mode, enabled, status, card_id FROM autobuy_rules WHERE event_id = ?').all(req.params.eventId);
  const hasSnipeRule = rules.some(r => r.mode === 'snipe');
  const hasAutoRule = rules.some(r => r.mode === 'auto');
  const hasAnyRule = rules.length > 0;
  const enabledRules = rules.filter(r => r.enabled);

  // Check payment card
  const defaultCard = db.prepare('SELECT id, name, last_four, card_type FROM cards WHERE is_default = 1').get();
  const ruleCards = rules.filter(r => r.card_id).map(r => r.card_id);
  const hasCardAssigned = ruleCards.length > 0 || !!defaultCard;

  // Check selectors cached for platforms
  const selectorsByPlatform = {};
  let cachedSelectorsCount = 0;
  for (const p of PLATFORMS) {
    const selectors = db.prepare('SELECT COUNT(*) as c FROM scraped_selectors WHERE site_name = ?').get(p)?.c || 0;
    selectorsByPlatform[p] = selectors > 0;
    if (selectors > 0) cachedSelectorsCount++;
  }

  // Historical comparables for ROI enrichment
  const comparables = getHistoricalComparables(event);

  // Calculate readiness score (0-100)
  const checks = {
    accounts_linked: { pass: totalAccounts > 0, weight: 25, detail: `${totalAccounts} active accounts across ${Object.values(accountsByPlatform).filter(c => c > 0).length} platforms` },
    payment_card: { pass: hasCardAssigned, weight: 25, detail: defaultCard ? `${defaultCard.card_type} ****${defaultCard.last_four}` : 'No card assigned' },
    autobuy_rule: { pass: hasAnyRule, weight: 30, detail: hasSnipeRule ? `Snipe rule active` : hasAutoRule ? `Auto rule active` : hasAnyRule ? `${enabledRules.length} rule(s) enabled` : 'No rules created' },
    selectors_cached: { pass: cachedSelectorsCount > 0, weight: 20, detail: `${cachedSelectorsCount}/${PLATFORMS.length} platforms cached` },
  };

  const score = Object.values(checks).reduce((s, c) => s + (c.pass ? c.weight : 0), 0);
  const status = score >= 80 ? 'go' : score >= 50 ? 'partial' : 'not_ready';

  res.json({
    event_id: event.id,
    event_name: event.name,
    artist: event.artist,
    on_sale_date: event.on_sale_date,
    readiness_score: score,
    readiness_status: status,
    checks,
    accounts_by_platform: accountsByPlatform,
    selectors_by_platform: selectorsByPlatform,
    rules,
    default_card: defaultCard || null,
    comparables,
  });
});

// GET /api/readiness/batch - readiness scores for multiple events
router.get('/', (req, res) => {
  const { event_ids } = req.query;
  if (!event_ids) return res.status(400).json({ error: 'event_ids query param required (comma-separated)' });

  const ids = String(event_ids).split(',').map(Number).filter(n => n > 0);
  if (ids.length === 0) return res.json([]);

  // Batch-fetch all the shared data once
  const accountCounts = {};
  for (const p of PLATFORMS) {
    accountCounts[p] = db.prepare('SELECT COUNT(*) as c FROM accounts WHERE platform = ? AND status = ?').get(p, 'active')?.c || 0;
  }
  const totalAccounts = Object.values(accountCounts).reduce((s, c) => s + c, 0);

  const defaultCard = db.prepare('SELECT id FROM cards WHERE is_default = 1').get();

  const selectorCounts = {};
  for (const p of PLATFORMS) {
    selectorCounts[p] = (db.prepare('SELECT COUNT(*) as c FROM scraped_selectors WHERE site_name = ?').get(p)?.c || 0) > 0;
  }
  const cachedPlatforms = Object.values(selectorCounts).filter(Boolean).length;

  const results = ids.map(eventId => {
    const rules = db.prepare('SELECT id, mode, enabled, card_id FROM autobuy_rules WHERE event_id = ?').all(eventId);
    const hasRule = rules.length > 0;
    const hasCard = rules.some(r => r.card_id) || !!defaultCard;

    let score = 0;
    if (totalAccounts > 0) score += 25;
    if (hasCard) score += 25;
    if (hasRule) score += 30;
    if (cachedPlatforms > 0) score += 20;

    return {
      event_id: eventId,
      readiness_score: score,
      readiness_status: score >= 80 ? 'go' : score >= 50 ? 'partial' : 'not_ready',
      has_accounts: totalAccounts > 0,
      has_card: hasCard,
      has_rule: hasRule,
      has_selectors: cachedPlatforms > 0,
    };
  });

  res.json(results);
});

function getHistoricalComparables(event) {
  // Try artist match first (highest confidence)
  let comps = db.prepare(`
    SELECT artist, venue, genre, event_date, face_value, avg_resale_price, roi_actual, demand_score_at_sale
    FROM historical_comparables WHERE LOWER(artist) = LOWER(?) ORDER BY event_date DESC LIMIT 5
  `).all(event.artist);

  const source = comps.length > 0 ? 'artist' : null;

  // Fallback to venue match
  if (comps.length < 3) {
    const venueComps = db.prepare(`
      SELECT artist, venue, genre, event_date, face_value, avg_resale_price, roi_actual, demand_score_at_sale
      FROM historical_comparables WHERE LOWER(venue) = LOWER(?) AND LOWER(artist) != LOWER(?)
      ORDER BY event_date DESC LIMIT 5
    `).all(event.venue, event.artist);
    comps = comps.concat(venueComps);
  }

  // Fallback to genre match
  if (comps.length < 3) {
    const genreComps = db.prepare(`
      SELECT artist, venue, genre, event_date, face_value, avg_resale_price, roi_actual, demand_score_at_sale
      FROM historical_comparables WHERE LOWER(genre) = LOWER(?)
        AND LOWER(artist) != LOWER(?) AND LOWER(venue) != LOWER(?)
      ORDER BY roi_actual DESC LIMIT 5
    `).all(event.genre, event.artist, event.venue);
    comps = comps.concat(genreComps);
  }

  if (comps.length === 0) return { available: false, projected_resale: null, confidence: 'low', comparables: [] };

  const avgResale = Math.round(comps.reduce((s, c) => s + (c.avg_resale_price || 0), 0) / comps.length);
  const avgRoi = Math.round(comps.reduce((s, c) => s + (c.roi_actual || 0), 0) / comps.length);
  const confidence = source === 'artist' && comps.length >= 3 ? 'high' : comps.length >= 2 ? 'medium' : 'low';

  return {
    available: true,
    match_type: source || (comps.length > 0 ? 'genre' : 'none'),
    projected_resale: avgResale,
    avg_historical_roi: avgRoi,
    confidence,
    sample_size: comps.length,
    comparables: comps.slice(0, 5),
  };
}

module.exports = router;
