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

function getOnSaleWindow(daysUntilOnSale) {
  if (daysUntilOnSale === null || daysUntilOnSale < 0) return null;
  if (daysUntilOnSale <= 7) return '7d';
  if (daysUntilOnSale <= 14) return '14d';
  if (daysUntilOnSale <= 30) return '30d';
  return null;
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

  return {
    ...event,
    trending: !!event.trending,
    resale_potential: Math.round(((event.max_price - event.face_value) / event.face_value) * 100),
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
    min_price,
    max_price,
    min_demand,
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
  if (genre) {
    sql += ' AND genre = ?';
    params.push(genre);
  }
  if (min_price) {
    sql += ' AND min_price >= ?';
    params.push(Number(min_price));
  }
  if (max_price) {
    sql += ' AND max_price <= ?';
    params.push(Number(max_price));
  }
  if (min_demand) {
    sql += ' AND demand_score >= ?';
    params.push(Number(min_demand));
  }
  if (hasUpcomingWindow) {
    sql += " AND on_sale_date IS NOT NULL AND date(on_sale_date) >= date('now') AND date(on_sale_date) <= date('now', ?)";
    params.push(`+${upcomingWindowDays} days`);
  }

  if (sort === 'price_asc') sql += ' ORDER BY min_price ASC';
  else if (sort === 'price_desc') sql += ' ORDER BY max_price DESC';
  else if (sort === 'demand') sql += ' ORDER BY demand_score DESC';
  else if (sort === 'date') sql += ' ORDER BY date ASC';
  else if (sort === 'roi') {
    sql += `
      ORDER BY (
        (max_price * 0.85 - COALESCE(min_price, face_value) - (COALESCE(min_price, face_value) * 0.12))
        * 1.0 / NULLIF(COALESCE(min_price, face_value), 0)
      ) DESC
    `;
  } else if (sort === 'on_sale' || hasUpcomingWindow) {
    sql += ' ORDER BY date(on_sale_date) ASC, demand_score DESC';
  } else {
    sql += ' ORDER BY demand_score DESC';
  }

  sql += ' LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const events = db.prepare(sql).all(...params);

  const enriched = events.map(enrichEvent);

  res.json(enriched);
});

// GET /api/events/genres - distinct genres
router.get('/genres', (req, res) => {
  const genres = db.prepare('SELECT DISTINCT genre FROM events ORDER BY genre').all();
  res.json(genres.map(g => g.genre));
});

// GET /api/events/:id - single event
router.get('/:id', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  res.json(enrichEvent(event));
});

module.exports = router;
