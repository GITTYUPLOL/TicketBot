const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/sniper/sessions - all active/recent sessions
router.get('/sessions', (req, res) => {
  const sessions = db.prepare(`
    SELECT ss.*, a.email as account_email, a.platform as account_platform,
      ar.event_name as rule_event_name, ar.mode as rule_mode
    FROM snipe_sessions ss
    LEFT JOIN accounts a ON ss.account_id = a.id
    LEFT JOIN autobuy_rules ar ON ss.rule_id = ar.id
    ORDER BY ss.updated_at DESC
  `).all();

  res.json(sessions.map(s => ({
    ...s,
    needs_input: !!s.needs_input,
    log: s.log ? JSON.parse(s.log) : [],
  })));
});

// POST /api/sniper/sessions - start a snipe session
router.post('/sessions', (req, res) => {
  const { rule_id, account_id, event_name, platform } = req.body;
  if (!platform) return res.status(400).json({ error: 'platform required' });

  const log = JSON.stringify([{ time: new Date().toISOString(), msg: 'Session created' }]);

  const result = db.prepare(`
    INSERT INTO snipe_sessions (rule_id, account_id, event_name, platform, status, log, started_at)
    VALUES (?, ?, ?, ?, 'starting', ?, datetime('now'))
  `).run(rule_id || null, account_id || null, event_name || null, platform, log);

  res.json({ id: result.lastInsertRowid });
});

// PATCH /api/sniper/sessions/:id - update session status
router.patch('/sessions/:id', (req, res) => {
  const session = db.prepare('SELECT * FROM snipe_sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { status, needs_input, input_type, browser_url, screenshot_url } = req.body;
  const updates = ['updated_at = datetime(\'now\')'];
  const params = [];

  if (status) { updates.push('status = ?'); params.push(status); }
  if (needs_input !== undefined) { updates.push('needs_input = ?'); params.push(needs_input ? 1 : 0); }
  if (input_type !== undefined) { updates.push('input_type = ?'); params.push(input_type); }
  if (browser_url !== undefined) { updates.push('browser_url = ?'); params.push(browser_url); }
  if (screenshot_url !== undefined) { updates.push('screenshot_url = ?'); params.push(screenshot_url); }

  // Append to log
  if (req.body.log_message) {
    const existingLog = session.log ? JSON.parse(session.log) : [];
    existingLog.push({ time: new Date().toISOString(), msg: req.body.log_message });
    updates.push('log = ?');
    params.push(JSON.stringify(existingLog));
  }

  params.push(req.params.id);
  db.prepare(`UPDATE snipe_sessions SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ success: true });
});

// POST /api/sniper/sessions/:id/resolve - user resolved the captcha/input
router.post('/sessions/:id/resolve', (req, res) => {
  const session = db.prepare('SELECT * FROM snipe_sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const log = session.log ? JSON.parse(session.log) : [];
  log.push({ time: new Date().toISOString(), msg: `User resolved ${session.input_type || 'input'} - resuming` });

  db.prepare(`
    UPDATE snipe_sessions SET needs_input = 0, input_type = NULL, status = 'running',
      log = ?, updated_at = datetime('now') WHERE id = ?
  `).run(JSON.stringify(log), req.params.id);

  res.json({ success: true });
});

// DELETE /api/sniper/sessions/:id
router.delete('/sessions/:id', (req, res) => {
  db.prepare('DELETE FROM snipe_sessions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/sniper/demo - create demo sessions for testing
router.post('/demo', (req, res) => {
  const log1 = JSON.stringify([
    { time: new Date(Date.now() - 120000).toISOString(), msg: 'Session started' },
    { time: new Date(Date.now() - 90000).toISOString(), msg: 'Navigating to event page' },
    { time: new Date(Date.now() - 60000).toISOString(), msg: 'Waiting for on-sale...' },
    { time: new Date(Date.now() - 30000).toISOString(), msg: 'Tickets available! Selecting seats...' },
    { time: new Date().toISOString(), msg: 'CAPTCHA detected - awaiting user input' },
  ]);
  const log2 = JSON.stringify([
    { time: new Date(Date.now() - 60000).toISOString(), msg: 'Session started' },
    { time: new Date(Date.now() - 45000).toISOString(), msg: 'Logged into StubHub' },
    { time: new Date(Date.now() - 20000).toISOString(), msg: 'Monitoring price for target...' },
    { time: new Date().toISOString(), msg: 'Running - checking every 5s' },
  ]);
  const log3 = JSON.stringify([
    { time: new Date(Date.now() - 30000).toISOString(), msg: 'Session started' },
    { time: new Date(Date.now() - 15000).toISOString(), msg: 'Queue detected' },
    { time: new Date().toISOString(), msg: 'Popup requires verification - user input needed' },
  ]);

  const insert = db.prepare(`
    INSERT INTO snipe_sessions (rule_id, account_id, event_name, platform, status, needs_input, input_type, browser_url, log, started_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  const tx = db.transaction(() => {
    insert.run(null, null, 'The Eras Tour - Final Shows', 'ticketmaster', 'needs_input', 1, 'captcha',
      'https://www.ticketmaster.com/event/12345', log1);
    insert.run(null, null, 'Midnights Til Dawn', 'stubhub', 'running', 0, null,
      'https://www.stubhub.com/event/67890', log2);
    insert.run(null, null, 'Coachella Weekend 1', 'axs', 'needs_input', 1, 'verification',
      'https://www.axs.com/event/11111', log3);
  });
  tx();

  res.json({ created: 3 });
});

module.exports = router;
