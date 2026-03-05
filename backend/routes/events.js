const express = require('express');
const router = express.Router();
const db = require('../db');
const MS_PER_DAY = 86400000;

function getConfidenceLevel(demandScore) {
  if (demandScore >= 75) return 'high';
  if (demandScore >= 55) return 'medium';
  return 'low';
}

function minimumScoreFromConfidence(confidence) {
  const value = String(confidence || '').trim().toLowerCase();
  if (value === 'high') return 75;
  if (value === 'medium') return 55;
  return 0;
}

function getDaysUntilOnSale(onSaleDate) {
  if (!onSaleDate) return null;

  const parsed = new Date(`${onSaleDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;

  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.ceil((parsed.getTime() - todayUTC) / MS_PER_DAY);
}

function getOnSaleWindow(daysUntilOnSale) {
  if (daysUntilOnSale === null || daysUntilOnSale < 0) return null;
  if (daysUntilOnSale <= 7) return '7d';
  if (daysUntilOnSale <= 14) return '14d';
  if (daysUntilOnSale <= 30) return '30d';
  return null;
}

function inferCategoryFromGenre(genre) {
  const normalized = String(genre || '').toLowerCase();
  if (!normalized) return 'other';
  if (normalized.includes('comedy')) return 'comedy';
  if (normalized.includes('theater') || normalized.includes('theatre') || normalized.includes('broadway')) return 'theater';
  if (normalized.includes('sport') || normalized.includes('boxing') || normalized.includes('mma') || normalized.includes('ufc')) return 'sports';
  if (normalized.includes('family')) return 'family';
  if (normalized.includes('festival')) return 'festivals';
  if (normalized.includes('music') || normalized.includes('rock') || normalized.includes('pop') || normalized.includes('hip-hop') || normalized.includes('country')) return 'concerts';
  return 'other';
}

function toPositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function enrichEvent(event) {
  const purchasePrice = Number(event.min_price || event.face_value || 0);
  const estimatedResale = Math.round(Number(event.max_price || purchasePrice) * 0.85);
  const estimatedFees = Math.round(purchasePrice * 0.12);
  const estimatedProfit = estimatedResale - purchasePrice - estimatedFees;
  const estimatedRoi = purchasePrice > 0
    ? Math.round((estimatedProfit / purchasePrice) * 100)
    : 0;
  const daysUntilOnSale = getDaysUntilOnSale(event.on_sale_date);
  const faceValue = Number(event.face_value || 0);

  return {
    ...event,
    category: event.category || inferCategoryFromGenre(event.genre),
    source_market: event.source_market || 'primary',
    trending: !!event.trending,
    resale_potential: faceValue > 0
      ? Math.round(((Number(event.max_price || 0) - faceValue) / faceValue) * 100)
      : 0,
    days_until_on_sale: daysUntilOnSale,
    on_sale_window: getOnSaleWindow(daysUntilOnSale),
    projected_entry_price: purchasePrice,
    projected_resale_price: estimatedResale,
    estimated_fees: estimatedFees,
    estimated_profit: estimatedProfit,
    estimated_roi: estimatedRoi,
    roi_confidence: getConfidenceLevel(event.demand_score),
  };
}

// GET /api/events - list with search & filters
router.get('/', (req, res) => {
  const {
    search,
    genre,
    category,
    subcategory,
    league,
    country,
    source_market,
    min_price,
    max_price,
    min_demand,
    min_roi,
    min_confidence,
    upcoming_window,
    sort,
    limit = 50,
    offset = 0,
  } = req.query;

  const upcomingWindowDays = Number(upcoming_window);
  const hasUpcomingWindow = Number.isFinite(upcomingWindowDays) && upcomingWindowDays > 0;

  let sql = 'SELECT * FROM events WHERE 1=1';
  const params = [];

  if (search) {
    sql += ' AND (artist LIKE ? OR name LIKE ? OR venue LIKE ? OR city LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }
  if (genre && genre !== 'all') {
    sql += ' AND genre = ?';
    params.push(genre);
  }
  if (category && category !== 'all') {
    sql += " AND lower(COALESCE(category, 'other')) = ?";
    const normalized = String(category).toLowerCase();
    params.push(normalized);
  }
  if (subcategory && subcategory !== 'all') {
    sql += ' AND lower(COALESCE(subcategory, \'\')) = ?';
    params.push(String(subcategory).toLowerCase());
  }
  if (league && league !== 'all') {
    sql += ' AND lower(COALESCE(league, \'\')) = ?';
    params.push(String(league).toLowerCase());
  }
  if (country && country !== 'all') {
    sql += ' AND upper(COALESCE(country_code, \'\')) = ?';
    params.push(String(country).toUpperCase());
  }
  if (source_market && source_market !== 'all') {
    sql += ' AND lower(COALESCE(source_market, \'primary\')) = ?';
    params.push(String(source_market).toLowerCase());
  }

  const minPrice = toPositiveNumber(min_price);
  if (minPrice !== undefined) {
    sql += ' AND min_price >= ?';
    params.push(minPrice);
  }

  const maxPrice = toPositiveNumber(max_price);
  if (maxPrice !== undefined) {
    sql += ' AND max_price <= ?';
    params.push(maxPrice);
  }

  const minDemand = Math.max(
    toPositiveNumber(min_demand) || 0,
    minimumScoreFromConfidence(min_confidence)
  );
  if (minDemand > 0) {
    sql += ' AND demand_score >= ?';
    params.push(minDemand);
  }

  const minRoi = Number(min_roi);
  if (Number.isFinite(minRoi)) {
    sql += `
      AND (
        ((max_price * 0.85 - COALESCE(min_price, face_value) - (COALESCE(min_price, face_value) * 0.12))
        * 100.0 / NULLIF(COALESCE(min_price, face_value), 0))
      ) >= ?
    `;
    params.push(minRoi);
  }

  if (hasUpcomingWindow) {
    sql += " AND on_sale_date IS NOT NULL AND date(on_sale_date) >= date('now') AND date(on_sale_date) <= date('now', ?)";
    params.push(`+${upcomingWindowDays} days`);
  }

  if (sort === 'price_asc') sql += ' ORDER BY min_price ASC';
  else if (sort === 'price_desc') sql += ' ORDER BY max_price DESC';
  else if (sort === 'demand') sql += ' ORDER BY demand_score DESC';
  else if (sort === 'date') sql += ' ORDER BY date ASC';
  else if (sort === 'category') sql += ' ORDER BY category ASC, demand_score DESC';
  else if (sort === 'league') sql += ' ORDER BY league ASC, demand_score DESC';
  else if (sort === 'roi') {
    sql += `
      ORDER BY (
        (max_price * 0.85 - COALESCE(min_price, face_value) - (COALESCE(min_price, face_value) * 0.12))
        * 1.0 / NULLIF(COALESCE(min_price, face_value), 0)
      ) DESC
    `;
  } else if (sort === 'on_sale' || hasUpcomingWindow) {
    sql += ' ORDER BY CASE WHEN on_sale_date IS NULL THEN 1 ELSE 0 END, date(on_sale_date) ASC, demand_score DESC';
  } else {
    sql += ' ORDER BY demand_score DESC';
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  sql += ' LIMIT ? OFFSET ?';
  params.push(safeLimit, safeOffset);

  const events = db.prepare(sql).all(...params);
  const enriched = events.map(enrichEvent);

  res.json(enriched);
});

// GET /api/events/filters - available filter values
router.get('/filters', (_req, res) => {
  const categories = db.prepare(`
    SELECT DISTINCT lower(COALESCE(category, ?)) AS value
    FROM events
    ORDER BY value
  `).all('other').map((row) => row.value);

  const subcategories = db.prepare(`
    SELECT DISTINCT subcategory AS value
    FROM events
    WHERE subcategory IS NOT NULL AND subcategory <> ''
    ORDER BY value
  `).all().map((row) => row.value);

  const leagues = db.prepare(`
    SELECT DISTINCT league AS value
    FROM events
    WHERE league IS NOT NULL AND league <> ''
    ORDER BY value
  `).all().map((row) => row.value);

  const countries = db.prepare(`
    SELECT DISTINCT country_code AS value
    FROM events
    WHERE country_code IS NOT NULL AND country_code <> ''
    ORDER BY value
  `).all().map((row) => row.value);

  const sourceMarkets = db.prepare(`
    SELECT DISTINCT lower(COALESCE(source_market, 'primary')) AS value
    FROM events
    ORDER BY value
  `).all().map((row) => row.value);

  res.json({
    categories,
    subcategories,
    leagues,
    countries,
    source_markets: sourceMarkets,
  });
});

// GET /api/events/genres - distinct genres
router.get('/genres', (_req, res) => {
  const genres = db.prepare('SELECT DISTINCT genre FROM events ORDER BY genre').all();
  res.json(genres.map((entry) => entry.genre));
});

// GET /api/events/:id - single event (numeric only to avoid capturing routes like /filters)
router.get('/:id(\\d+)', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  res.json(enrichEvent(event));
});

module.exports = router;
