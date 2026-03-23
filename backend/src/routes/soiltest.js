const express = require('express');
const router = express.Router();
const db = require('../db');

function isValidDate(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));
}

function isValidNumber(val) {
  if (val === null || val === undefined || val === '') return true;
  const num = parseFloat(val);
  return !isNaN(num) && num >= 0;
}

// GET /api/soiltest
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM soil_tests ORDER BY date DESC').all();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching soil tests:', err);
    res.status(500).json({ error: 'Failed to fetch soil tests' });
  }
});

// POST /api/soiltest
router.post('/', (req, res) => {
  const { date, notes, ph, om_pct, p_ppm, k_ppm } = req.body;

  if (!date) return res.status(400).json({ error: 'date is required' });
  if (!isValidDate(date)) return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });

  if (!isValidNumber(ph) || (ph !== '' && ph !== null && ph !== undefined && parseFloat(ph) > 14)) {
    return res.status(400).json({ error: 'ph must be between 0 and 14' });
  }
  if (!isValidNumber(om_pct) || !isValidNumber(p_ppm) || !isValidNumber(k_ppm)) {
    return res.status(400).json({ error: 'om_pct, p_ppm, and k_ppm must be non-negative numbers' });
  }

  try {
    const stmt = db.prepare(
      'INSERT INTO soil_tests (date, notes, ph, om_pct, p_ppm, k_ppm) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
      date,
      notes || null,
      ph !== '' && ph !== null && ph !== undefined ? parseFloat(ph) : null,
      om_pct !== '' && om_pct !== null && om_pct !== undefined ? parseFloat(om_pct) : null,
      p_ppm !== '' && p_ppm !== null && p_ppm !== undefined ? parseFloat(p_ppm) : null,
      k_ppm !== '' && k_ppm !== null && k_ppm !== undefined ? parseFloat(k_ppm) : null,
    );
    const newEntry = db.prepare('SELECT * FROM soil_tests WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newEntry);
  } catch (err) {
    console.error('Error creating soil test:', err);
    res.status(500).json({ error: 'Failed to create soil test' });
  }
});

// DELETE /api/soiltest/:id
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  try {
    const result = db.prepare('DELETE FROM soil_tests WHERE id = ?').run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'Entry not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting soil test:', err);
    res.status(500).json({ error: 'Failed to delete soil test' });
  }
});

module.exports = router;
