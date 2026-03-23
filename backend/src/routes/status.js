const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/status/position — current max log ID (used by client before opening SSE)
router.get('/position', (req, res) => {
  try {
    const row = db.prepare('SELECT COALESCE(MAX(id), 0) as id FROM collector_log').get();
    res.json({ id: row.id });
  } catch (_) {
    res.json({ id: 0 });
  }
});

// GET /api/status/stream?since_id=<id> — SSE stream of collector log entries
router.get('/stream', (req, res) => {
  const sinceId = Math.max(0, parseInt(req.query.since_id, 10) || 0);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let lastId = sinceId;

  const poll = setInterval(() => {
    try {
      const rows = db
        .prepare('SELECT id, level, message FROM collector_log WHERE id > ? ORDER BY id ASC')
        .all(lastId);

      for (const row of rows) {
        res.write(`data: ${JSON.stringify({ level: row.level, message: row.message })}\n\n`);
        lastId = row.id;
        if (row.level === 'done') {
          clearInterval(poll);
          clearTimeout(timeout);
          res.end();
          return;
        }
      }
    } catch (_) {
      // table may not exist yet — ignore
    }
  }, 1000);

  // Safety timeout after 15 minutes
  const timeout = setTimeout(() => {
    clearInterval(poll);
    res.end();
  }, 15 * 60 * 1000);

  req.on('close', () => {
    clearInterval(poll);
    clearTimeout(timeout);
  });
});

module.exports = router;
