const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/orders
router.get('/', (req, res) => {
  const orders = db.prepare(`
    SELECT o.*, e.name as event_name, e.artist, e.venue, e.date as event_date,
      c.name as card_name, c.last_four as card_last_four, c.card_type
    FROM orders o
    LEFT JOIN events e ON o.event_id = e.id
    LEFT JOIN cards c ON o.card_id = c.id
    ORDER BY o.created_at DESC
  `).all();

  res.json(orders);
});

// GET /api/orders/stats
router.get('/stats', (req, res) => {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_orders,
      ROUND(SUM(total), 2) as total_spent,
      ROUND(SUM(CASE WHEN profit > 0 THEN profit ELSE 0 END), 2) as total_profit,
      ROUND(SUM(CASE WHEN profit < 0 THEN profit ELSE 0 END), 2) as total_loss,
      ROUND(AVG(profit), 2) as avg_profit,
      SUM(CASE WHEN profit > 0 THEN 1 ELSE 0 END) as profitable_count,
      SUM(CASE WHEN profit <= 0 THEN 1 ELSE 0 END) as loss_count
    FROM orders
  `).get();

  res.json(stats);
});

module.exports = router;
