const express = require('express');
const router = express.Router();
const db = require('../db');

// Validation helpers
function isValidDate(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));
}

function isValidPercentage(val) {
  if (val === null || val === undefined || val === '') return true; // Optional field
  const num = parseFloat(val);
  return !isNaN(num) && num >= 0 && num <= 100;
}

function isValidNumber(val) {
  if (val === null || val === undefined || val === '') return true; // Optional field
  const num = parseFloat(val);
  return !isNaN(num) && num >= 0;
}

// GET /api/worklog
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM work_log ORDER BY date DESC').all();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching work log:', err);
    res.status(500).json({ error: 'Failed to fetch work log' });
  }
});

// POST /api/worklog
router.post('/', (req, res) => {
  const {
    date,
    activity,
    notes,
    n_pct,
    p_pct,
    k_pct,
    fe_pct,
    s_pct,
    lbs_applied,
    spreader_setting,
  } = req.body;
  
  // Validate required fields
  if (!date || !activity) {
    return res.status(400).json({ error: 'date and activity are required' });
  }
  
  // Validate date format
  if (!isValidDate(date)) {
    return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
  }
  
  // Validate activity is not empty string
  if (typeof activity !== 'string' || activity.trim().length === 0) {
    return res.status(400).json({ error: 'activity must be a non-empty string' });
  }
  
  // Validate nutrient percentages (0-100)
  if (!isValidPercentage(n_pct) || !isValidPercentage(p_pct) || !isValidPercentage(k_pct) ||
      !isValidPercentage(fe_pct) || !isValidPercentage(s_pct)) {
    return res.status(400).json({ error: 'nutrient percentages must be between 0 and 100' });
  }
  
  // Validate numeric fields
  if (!isValidNumber(lbs_applied)) {
    return res.status(400).json({ error: 'lbs_applied must be a non-negative number' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO work_log (
        date, activity, notes,
        n_pct, p_pct, k_pct, fe_pct, s_pct,
        lbs_applied, spreader_setting
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      date,
      activity,
      notes || null,
      n_pct ? parseFloat(n_pct) : null,
      p_pct ? parseFloat(p_pct) : null,
      k_pct ? parseFloat(k_pct) : null,
      fe_pct ? parseFloat(fe_pct) : null,
      s_pct ? parseFloat(s_pct) : null,
      lbs_applied ? parseFloat(lbs_applied) : null,
      spreader_setting || null
    );

    const newEntry = db
      .prepare('SELECT * FROM work_log WHERE id = ?')
      .get(result.lastInsertRowid);
    res.status(201).json(newEntry);
  } catch (err) {
    console.error('Error creating work log entry:', err);
    res.status(500).json({ error: 'Failed to create work log entry' });
  }
});

// DELETE /api/worklog/:id
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  try {
    db.transaction(() => {
      // If a planned_work entry was completed into this work_log row, unlink it
      // so it returns to the plan list rather than orphaning the foreign key
      db.prepare('UPDATE planned_work SET completed = 0, work_log_id = NULL WHERE work_log_id = ?').run(id);
      db.prepare('DELETE FROM work_log WHERE id = ?').run(id);
    })();

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting work log entry:', err);
    res.status(500).json({ error: 'Failed to delete work log entry' });
  }
});

module.exports = router;
