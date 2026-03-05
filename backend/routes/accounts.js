const express = require('express');
const router = express.Router();
const db = require('../db');

const PLATFORMS = ['ticketmaster', 'stubhub', 'seatgeek', 'axs', 'vividseats', 'livenation'];

// GET /api/accounts
router.get('/', (req, res) => {
  const { platform } = req.query;
  let sql = 'SELECT id, platform, email, username, status, last_login, notes, created_at FROM accounts';
  const params = [];
  if (platform) {
    sql += ' WHERE platform = ?';
    params.push(platform);
  }
  sql += ' ORDER BY platform, created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

// GET /api/accounts/platforms
router.get('/platforms', (req, res) => {
  res.json(PLATFORMS);
});

// GET /api/accounts/stats
router.get('/stats', (req, res) => {
  const stats = db.prepare(`
    SELECT platform, COUNT(*) as count,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count
    FROM accounts GROUP BY platform ORDER BY platform
  `).all();
  res.json(stats);
});

// POST /api/accounts - single add
router.post('/', (req, res) => {
  const { platform, email, username, password, notes } = req.body;
  if (!platform || !email) return res.status(400).json({ error: 'platform and email required' });
  if (!PLATFORMS.includes(platform)) return res.status(400).json({ error: `Invalid platform. Use: ${PLATFORMS.join(', ')}` });

  const result = db.prepare(
    'INSERT INTO accounts (platform, email, username, password_hash, notes) VALUES (?, ?, ?, ?, ?)'
  ).run(platform, email, username || null, password || null, notes || null);

  res.json({ id: result.lastInsertRowid, platform, email, username, status: 'active' });
});

// POST /api/accounts/bulk - bulk import
router.post('/bulk', (req, res) => {
  const { accounts } = req.body;
  if (!Array.isArray(accounts) || accounts.length === 0) {
    return res.status(400).json({ error: 'accounts array required' });
  }

  const insert = db.prepare(
    'INSERT INTO accounts (platform, email, username, password_hash, notes) VALUES (?, ?, ?, ?, ?)'
  );

  const results = { added: 0, skipped: 0, errors: [] };

  const bulkInsert = db.transaction(() => {
    for (const acc of accounts) {
      if (!acc.platform || !acc.email) {
        results.skipped++;
        results.errors.push(`Missing platform/email for entry: ${JSON.stringify(acc).slice(0, 80)}`);
        continue;
      }
      if (!PLATFORMS.includes(acc.platform)) {
        results.skipped++;
        results.errors.push(`Invalid platform "${acc.platform}" for ${acc.email}`);
        continue;
      }
      // Skip duplicates
      const existing = db.prepare('SELECT id FROM accounts WHERE platform = ? AND email = ?').get(acc.platform, acc.email);
      if (existing) {
        results.skipped++;
        continue;
      }
      insert.run(acc.platform, acc.email, acc.username || null, acc.password || null, acc.notes || null);
      results.added++;
    }
  });

  bulkInsert();
  res.json(results);
});

// POST /api/accounts/bulk-text - parse from text (email:pass format, one per line)
router.post('/bulk-text', (req, res) => {
  const { platform, text } = req.body;
  if (!platform || !text) return res.status(400).json({ error: 'platform and text required' });
  if (!PLATFORMS.includes(platform)) return res.status(400).json({ error: 'Invalid platform' });

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const insert = db.prepare(
    'INSERT INTO accounts (platform, email, username, password_hash, notes) VALUES (?, ?, ?, ?, ?)'
  );

  const results = { added: 0, skipped: 0 };

  const bulkInsert = db.transaction(() => {
    for (const line of lines) {
      // Supports: email:password, email:password:username, or just email
      const parts = line.split(/[:\t|]/);
      const email = parts[0]?.trim();
      const password = parts[1]?.trim() || null;
      const username = parts[2]?.trim() || null;

      if (!email || !email.includes('@')) { results.skipped++; continue; }

      const existing = db.prepare('SELECT id FROM accounts WHERE platform = ? AND email = ?').get(platform, email);
      if (existing) { results.skipped++; continue; }

      insert.run(platform, email, username, password, null);
      results.added++;
    }
  });

  bulkInsert();
  res.json(results);
});

// PATCH /api/accounts/:id
router.patch('/:id', (req, res) => {
  const { status, email, username, password, notes } = req.body;
  const updates = [];
  const params = [];

  if (status) { updates.push('status = ?'); params.push(status); }
  if (email) { updates.push('email = ?'); params.push(email); }
  if (username !== undefined) { updates.push('username = ?'); params.push(username); }
  if (password !== undefined) { updates.push('password_hash = ?'); params.push(password); }
  if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  params.push(req.params.id);
  db.prepare(`UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ success: true });
});

// DELETE /api/accounts/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// DELETE /api/accounts/platform/:platform - delete all for a platform
router.delete('/platform/:platform', (req, res) => {
  const result = db.prepare('DELETE FROM accounts WHERE platform = ?').run(req.params.platform);
  res.json({ deleted: result.changes });
});

module.exports = router;
