const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/tickets/:eventId - listings for an event
router.get('/:eventId', (req, res) => {
  const { sort, source, section } = req.query;

  let sql = 'SELECT * FROM tickets WHERE event_id = ?';
  const params = [req.params.eventId];

  if (source) {
    sql += ' AND source = ?';
    params.push(source);
  }
  if (section) {
    sql += ' AND section = ?';
    params.push(section);
  }

  if (sort === 'price_asc') sql += ' ORDER BY price ASC';
  else if (sort === 'price_desc') sql += ' ORDER BY price DESC';
  else sql += ' ORDER BY price ASC';

  const tickets = db.prepare(sql).all(...params);
  res.json(tickets);
});

// POST /api/tickets/:id/purchase
router.post('/:id/purchase', (req, res) => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const { card_id, quantity = 1 } = req.body;

  const card = card_id
    ? db.prepare('SELECT * FROM cards WHERE id = ?').get(card_id)
    : db.prepare('SELECT * FROM cards WHERE is_default = 1').get();

  if (!card) return res.status(400).json({ error: 'No payment card found' });

  const total = ticket.price * quantity + ticket.fees;
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(ticket.event_id);
  const resaleValue = event ? Math.round(event.max_price * 0.85) : null;
  const profit = resaleValue ? (resaleValue * quantity - total) : null;

  const result = db.prepare(`
    INSERT INTO orders (event_id, ticket_id, card_id, quantity, price_paid, fees, total, resale_value, profit, source, purchased_via)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(ticket.event_id, ticket.id, card.id, quantity, ticket.price, ticket.fees, total, resaleValue, profit, ticket.source, 'manual');

  res.json({
    order_id: result.lastInsertRowid,
    total,
    resale_value: resaleValue,
    estimated_profit: profit,
    card_used: `${card.card_type} ****${card.last_four}`,
  });
});

module.exports = router;
