const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/cards
router.get('/', (req, res) => {
  const cards = db.prepare('SELECT * FROM cards ORDER BY is_default DESC, created_at DESC').all();
  res.json(cards);
});

// POST /api/cards
router.post('/', (req, res) => {
  const { name, last_four, expiry, card_type = 'visa', is_default = false } = req.body;
  if (!name || !last_four || !expiry) {
    return res.status(400).json({ error: 'name, last_four, and expiry are required' });
  }

  if (is_default) {
    db.prepare('UPDATE cards SET is_default = 0').run();
  }

  const result = db.prepare(
    'INSERT INTO cards (name, last_four, expiry, card_type, is_default) VALUES (?, ?, ?, ?, ?)'
  ).run(name, last_four, expiry, card_type, is_default ? 1 : 0);

  res.json({ id: result.lastInsertRowid, name, last_four, expiry, card_type, is_default });
});

// PATCH /api/cards/:id/default
router.patch('/:id/default', (req, res) => {
  db.prepare('UPDATE cards SET is_default = 0').run();
  db.prepare('UPDATE cards SET is_default = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// DELETE /api/cards/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM cards WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
