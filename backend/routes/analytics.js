const express = require('express');
const router = express.Router();
const db = require('../db');
const MS_PER_DAY = 86400000;

function getConfidenceLevel(demandScore) {
  if (demandScore >= 75) return 'high';
  if (demandScore >= 55) return 'medium';
  return 'low';
}

function getDaysUntilOnSale(onSaleDate) {
  if (!onSaleDate) return null;

  const parsed = new Date(`${onSaleDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;

  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.ceil((parsed.getTime() - todayUTC) / MS_PER_DAY);
}

function getSaleWindow(daysUntilOnSale) {
  if (daysUntilOnSale === null || daysUntilOnSale < 0) return null;
  if (daysUntilOnSale <= 7) return '7d';
  if (daysUntilOnSale <= 14) return '14d';
  if (daysUntilOnSale <= 30) return '30d';
  return null;
}

function getSaleWindowPriority(window) {
  if (window === '7d') return 1;
  if (window === '14d') return 2;
  if (window === '30d') return 3;
  return 99;
}

function minimumScoreFromConfidence(confidence) {
  const normalized = String(confidence || '').trim().toLowerCase();
  if (normalized === 'high') return 75;
  if (normalized === 'medium') return 55;
  return 0;
}

function pushOptionalFilter(filters, params, expression, value, transform = (input) => input) {
  if (value === undefined || value === null || value === '' || value === 'all') return;
  filters.push(expression);
  params.push(transform(value));
}

function enrichOpportunity(event) {
  const projectedEntryPrice = Number(event.min_price || event.face_value || 0);
  const projectedResalePrice = Math.round(Number(event.max_price || projectedEntryPrice) * 0.85);
  const estimatedFees = Math.round(projectedEntryPrice * 0.12);
  const estimatedProfit = projectedResalePrice - projectedEntryPrice - estimatedFees;
  const estimatedRoi = projectedEntryPrice > 0
    ? Math.round((estimatedProfit / projectedEntryPrice) * 100)
    : 0;
  const daysUntilOnSale = getDaysUntilOnSale(event.on_sale_date);
  const onSaleWindow = getSaleWindow(daysUntilOnSale);

  return {
    ...event,
    projected_entry_price: projectedEntryPrice,
    projected_resale_price: projectedResalePrice,
    estimated_fees: estimatedFees,
    estimated_profit: estimatedProfit,
    estimated_roi: estimatedRoi,
    roi_confidence: getConfidenceLevel(event.demand_score),
    days_until_on_sale: daysUntilOnSale,
    on_sale_window: onSaleWindow,
    sale_window_priority: getSaleWindowPriority(onSaleWindow),
    resale_potential: event.face_value
      ? Math.round(((event.max_price - event.face_value) / event.face_value) * 100)
      : 0,
  };
}

// GET /api/analytics/upcoming-opportunities
router.get('/upcoming-opportunities', (req, res) => {
  const requestedLimit = Number(req.query.limit || 18);
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 100)
    : 18;
  const minRoi = Number(req.query.min_roi);
  const minConfidence = minimumScoreFromConfidence(req.query.min_confidence);
  const filters = [
    'on_sale_date IS NOT NULL',
    "date(on_sale_date) >= date('now')",
    "date(on_sale_date) <= date('now', '+30 days')",
  ];
  const params = [];

  pushOptionalFilter(filters, params, "lower(COALESCE(category, 'other')) = ?", req.query.category, (value) => String(value).toLowerCase());
  pushOptionalFilter(filters, params, "lower(COALESCE(league, '')) = ?", req.query.league, (value) => String(value).toLowerCase());
  pushOptionalFilter(filters, params, "upper(COALESCE(country_code, '')) = ?", req.query.country, (value) => String(value).toUpperCase());
  pushOptionalFilter(filters, params, "lower(COALESCE(source_market, 'primary')) = ?", req.query.source_market, (value) => String(value).toLowerCase());

  const events = db.prepare(`
    SELECT id, name, artist, venue, city, country_code, category, subcategory, league, source_market,
      date, on_sale_date, demand_score, min_price, max_price, face_value, genre
    FROM events
    WHERE ${filters.join(' AND ')}
  `).all(...params);

  const filteredEvents = events
    .map(enrichOpportunity)
    .filter((event) => event.on_sale_window)
    .filter((event) => event.demand_score >= minConfidence)
    .filter((event) => !Number.isFinite(minRoi) || event.estimated_roi >= minRoi);

  const opportunities = filteredEvents
    .sort((a, b) =>
      a.sale_window_priority - b.sale_window_priority ||
      b.estimated_roi - a.estimated_roi ||
      a.days_until_on_sale - b.days_until_on_sale
    )
    .slice(0, limit)
    .map(({ sale_window_priority, ...event }) => event);

  const counts = filteredEvents.reduce(
    (summary, event) => {
      if (event.on_sale_window === '7d') summary.window_7d += 1;
      else if (event.on_sale_window === '14d') summary.window_14d += 1;
      else if (event.on_sale_window === '30d') summary.window_30d += 1;
      return summary;
    },
    { window_7d: 0, window_14d: 0, window_30d: 0 }
  );

  res.json({
    windows: counts,
    opportunities,
    generated_at: new Date().toISOString(),
  });
});

// GET /api/analytics/trending
router.get('/trending', (req, res) => {
  const events = db.prepare(`
    SELECT id, name, artist, venue, city, date, on_sale_date, demand_score, min_price, max_price, face_value, genre
    FROM events
    WHERE on_sale_date IS NOT NULL
      AND date(on_sale_date) >= date('now')
      AND date(on_sale_date) <= date('now', '+30 days')
    ORDER BY demand_score DESC, date(on_sale_date) ASC
    LIMIT 10
  `).all();

  res.json(events.map(enrichOpportunity));
});

// GET /api/analytics/price-history/:eventId
router.get('/price-history/:eventId', (req, res) => {
  const history = db.prepare(`
    SELECT date, avg_price, min_price, max_price, volume
    FROM price_history WHERE event_id = ? ORDER BY date ASC
  `).all(req.params.eventId);
  res.json(history);
});

// GET /api/analytics/market-heatmap
router.get('/market-heatmap', (req, res) => {
  const genres = db.prepare(`
    SELECT genre,
      COUNT(*) as event_count,
      ROUND(AVG(demand_score), 1) as avg_demand,
      ROUND(AVG(max_price - face_value), 0) as avg_markup,
      ROUND(AVG(((max_price - face_value) * 1.0 / face_value) * 100), 0) as avg_roi
    FROM events GROUP BY genre ORDER BY avg_demand DESC
  `).all();

  const venues = db.prepare(`
    SELECT venue, city,
      COUNT(*) as event_count,
      ROUND(AVG(demand_score), 1) as avg_demand,
      ROUND(AVG(max_price), 0) as avg_max_price
    FROM events GROUP BY venue ORDER BY avg_demand DESC LIMIT 10
  `).all();

  res.json({ genres, venues });
});

// GET /api/analytics/best-time-to-buy/:eventId
router.get('/best-time-to-buy/:eventId', (req, res) => {
  const history = db.prepare(`
    SELECT date, avg_price, min_price FROM price_history
    WHERE event_id = ? ORDER BY date ASC
  `).all(req.params.eventId);

  if (history.length < 2) return res.json({ recommendation: 'Not enough data' });

  let lowestIdx = 0;
  for (let i = 1; i < history.length; i++) {
    if (history[i].min_price < history[lowestIdx].min_price) lowestIdx = i;
  }

  const recent = history.slice(-7);
  const recentAvg = recent.reduce((s, h) => s + h.avg_price, 0) / recent.length;
  const overall = history.reduce((s, h) => s + h.avg_price, 0) / history.length;
  const trend = recentAvg > overall ? 'rising' : 'falling';

  res.json({
    trend,
    lowest_date: history[lowestIdx].date,
    lowest_price: history[lowestIdx].min_price,
    current_avg: Math.round(recentAvg),
    recommendation: trend === 'falling' ? 'Wait - prices are dropping' : 'Buy soon - prices are rising',
  });
});

// GET /api/analytics/supply-demand
router.get('/supply-demand', (req, res) => {
  const events = db.prepare(`
    SELECT e.id, e.name, e.artist, e.demand_score,
      (SELECT COUNT(*) FROM tickets t WHERE t.event_id = e.id) as supply,
      (SELECT COALESCE(SUM(volume), 0) FROM price_history ph WHERE ph.event_id = e.id AND ph.date >= date('now', '-7 days')) as recent_volume
    FROM events e ORDER BY e.demand_score DESC LIMIT 15
  `).all();

  res.json(events.map(e => ({
    ...e,
    supply_level: e.supply > 10 ? 'high' : e.supply > 5 ? 'medium' : 'low',
    demand_level: e.demand_score > 75 ? 'high' : e.demand_score > 50 ? 'medium' : 'low',
  })));
});

// GET /api/analytics/roi-calculator
router.get('/roi-calculator', (req, res) => {
  const { event_id, buy_price } = req.query;

  if (event_id) {
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(event_id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const purchase = Number(buy_price) || event.min_price;
    const estimatedResale = Math.round(event.max_price * 0.85);
    const fees = Math.round(purchase * 0.12);
    const profit = estimatedResale - purchase - fees;
    const roi = Math.round((profit / purchase) * 100);

    return res.json({
      event_name: event.name,
      purchase_price: purchase,
      estimated_resale: estimatedResale,
      fees,
      estimated_profit: profit,
      roi_percent: roi,
      confidence: event.demand_score > 75 ? 'high' : event.demand_score > 50 ? 'medium' : 'low',
    });
  }

  // General top ROI events
  const events = db.prepare(`
    SELECT id, name, artist, venue, city, date, on_sale_date, face_value, min_price, max_price, demand_score
    FROM events
    WHERE on_sale_date IS NOT NULL
      AND date(on_sale_date) >= date('now')
      AND date(on_sale_date) <= date('now', '+30 days')
    ORDER BY ((max_price - min_price) * 1.0 / min_price) DESC
    LIMIT 10
  `).all();

  res.json(events.map(enrichOpportunity));
});

module.exports = router;
