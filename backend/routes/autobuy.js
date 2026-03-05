const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/autobuy
router.get('/', (req, res) => {
  const rules = db.prepare(`
    SELECT ar.*, e.artist, e.venue, e.date as event_date
    FROM autobuy_rules ar
    LEFT JOIN events e ON ar.event_id = e.id
    ORDER BY ar.created_at DESC
  `).all();

  res.json(rules.map(r => ({
    ...r,
    enabled: !!r.enabled,
    execution_log: r.execution_log ? JSON.parse(r.execution_log) : [],
  })));
});

// POST /api/autobuy
router.post('/', (req, res) => {
  const { event_id, event_name, mode, max_price, target_price, section_filter, quantity = 1, card_id } = req.body;

  if (!mode || !['alert', 'auto', 'snipe'].includes(mode)) {
    return res.status(400).json({ error: 'Valid mode required: alert, auto, or snipe' });
  }

  const log = JSON.stringify([{ time: new Date().toISOString(), msg: 'Rule created' }]);
  const status = mode === 'snipe' ? 'scheduled' : mode === 'alert' ? 'watching' : 'active';

  const result = db.prepare(`
    INSERT INTO autobuy_rules (event_id, event_name, mode, max_price, target_price, section_filter, quantity, card_id, enabled, status, execution_log)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(event_id, event_name, mode, max_price, target_price, section_filter, quantity, card_id, status, log);

  res.json({ id: result.lastInsertRowid, status });
});

// PATCH /api/autobuy/:id
router.patch('/:id', (req, res) => {
  const rule = db.prepare('SELECT * FROM autobuy_rules WHERE id = ?').get(req.params.id);
  if (!rule) return res.status(404).json({ error: 'Rule not found' });

  const updates = [];
  const params = [];

  for (const field of ['enabled', 'max_price', 'target_price', 'section_filter', 'quantity', 'card_id', 'status', 'mode']) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(field === 'enabled' ? (req.body[field] ? 1 : 0) : req.body[field]);
    }
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  params.push(req.params.id);
  db.prepare(`UPDATE autobuy_rules SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  // Log the change
  const log = rule.execution_log ? JSON.parse(rule.execution_log) : [];
  log.push({ time: new Date().toISOString(), msg: `Rule updated: ${updates.map(u => u.split(' =')[0]).join(', ')}` });
  db.prepare('UPDATE autobuy_rules SET execution_log = ? WHERE id = ?').run(JSON.stringify(log), req.params.id);

  res.json({ success: true });
});

// DELETE /api/autobuy/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM autobuy_rules WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
