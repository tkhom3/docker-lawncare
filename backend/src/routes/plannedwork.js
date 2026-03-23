const express = require('express');
const router = express.Router();
const db = require('../db');

function isValidDate(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));
}

function isValidPercentage(val) {
  if (val === null || val === undefined || val === '') return true;
  const num = parseFloat(val);
  return !isNaN(num) && num >= 0 && num <= 100;
}

function isValidNumber(val) {
  if (val === null || val === undefined || val === '') return true;
  const num = parseFloat(val);
  return !isNaN(num) && num >= 0;
}

// GET /api/planned-work
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM planned_work ORDER BY planned_date ASC').all();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching planned work:', err);
    res.status(500).json({ error: 'Failed to fetch planned work' });
  }
});

// POST /api/planned-work
router.post('/', (req, res) => {
  const {
    planned_date,
    activity,
    notes,
    n_pct,
    p_pct,
    k_pct,
    fe_pct,
    s_pct,
    lbs_planned,
    spreader_setting,
  } = req.body;

  if (!planned_date || !activity) {
    return res.status(400).json({ error: 'planned_date and activity are required' });
  }
  if (!isValidDate(planned_date)) {
    return res.status(400).json({ error: 'planned_date must be in YYYY-MM-DD format' });
  }
  if (typeof activity !== 'string' || activity.trim().length === 0) {
    return res.status(400).json({ error: 'activity must be a non-empty string' });
  }
  if (!isValidPercentage(n_pct) || !isValidPercentage(p_pct) || !isValidPercentage(k_pct) ||
      !isValidPercentage(fe_pct) || !isValidPercentage(s_pct)) {
    return res.status(400).json({ error: 'nutrient percentages must be between 0 and 100' });
  }
  if (!isValidNumber(lbs_planned)) {
    return res.status(400).json({ error: 'lbs_planned must be a non-negative number' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO planned_work (
        planned_date, activity, notes,
        n_pct, p_pct, k_pct, fe_pct, s_pct,
        lbs_planned, spreader_setting
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      planned_date,
      activity,
      notes || null,
      n_pct ? parseFloat(n_pct) : null,
      p_pct ? parseFloat(p_pct) : null,
      k_pct ? parseFloat(k_pct) : null,
      fe_pct ? parseFloat(fe_pct) : null,
      s_pct ? parseFloat(s_pct) : null,
      lbs_planned ? parseFloat(lbs_planned) : null,
      spreader_setting || null
    );

    const newEntry = db
      .prepare('SELECT * FROM planned_work WHERE id = ?')
      .get(result.lastInsertRowid);
    res.status(201).json(newEntry);
  } catch (err) {
    console.error('Error creating planned work entry:', err);
    res.status(500).json({ error: 'Failed to create planned work entry' });
  }
});

// PUT /api/planned-work/:id — update a planned work entry (only if not completed)
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const {
    planned_date,
    activity,
    notes,
    n_pct,
    p_pct,
    k_pct,
    fe_pct,
    s_pct,
    lbs_planned,
    spreader_setting,
  } = req.body;

  if (!planned_date || !activity) {
    return res.status(400).json({ error: 'planned_date and activity are required' });
  }
  if (!isValidDate(planned_date)) {
    return res.status(400).json({ error: 'planned_date must be in YYYY-MM-DD format' });
  }
  if (typeof activity !== 'string' || activity.trim().length === 0) {
    return res.status(400).json({ error: 'activity must be a non-empty string' });
  }
  if (!isValidPercentage(n_pct) || !isValidPercentage(p_pct) || !isValidPercentage(k_pct) ||
      !isValidPercentage(fe_pct) || !isValidPercentage(s_pct)) {
    return res.status(400).json({ error: 'nutrient percentages must be between 0 and 100' });
  }
  if (!isValidNumber(lbs_planned)) {
    return res.status(400).json({ error: 'lbs_planned must be a non-negative number' });
  }

  try {
    const entry = db.prepare('SELECT * FROM planned_work WHERE id = ?').get(id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    if (entry.completed) return res.status(400).json({ error: 'Cannot edit a completed entry' });

    db.prepare(`
      UPDATE planned_work SET
        planned_date = ?, activity = ?, notes = ?,
        n_pct = ?, p_pct = ?, k_pct = ?, fe_pct = ?, s_pct = ?,
        lbs_planned = ?, spreader_setting = ?
      WHERE id = ?
    `).run(
      planned_date,
      activity,
      notes || null,
      n_pct ? parseFloat(n_pct) : null,
      p_pct ? parseFloat(p_pct) : null,
      k_pct ? parseFloat(k_pct) : null,
      fe_pct ? parseFloat(fe_pct) : null,
      s_pct ? parseFloat(s_pct) : null,
      lbs_planned ? parseFloat(lbs_planned) : null,
      spreader_setting || null,
      id
    );

    res.json(db.prepare('SELECT * FROM planned_work WHERE id = ?').get(id));
  } catch (err) {
    console.error('Error updating planned work entry:', err);
    res.status(500).json({ error: 'Failed to update planned work entry' });
  }
});

// PATCH /api/planned-work/:id/complete — toggle completed, syncing work_log
router.patch('/:id/complete', (req, res) => {
  const { id } = req.params;
  try {
    const entry = db.prepare('SELECT * FROM planned_work WHERE id = ?').get(id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    let updatedEntry;

    if (!entry.completed) {
      // Marking complete — create a work_log entry
      const result = db.prepare(`
        INSERT INTO work_log (date, activity, notes, n_pct, p_pct, k_pct, fe_pct, s_pct, lbs_applied, spreader_setting)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        entry.planned_date,
        entry.activity,
        entry.notes,
        entry.n_pct,
        entry.p_pct,
        entry.k_pct,
        entry.fe_pct,
        entry.s_pct,
        entry.lbs_planned,
        entry.spreader_setting
      );

      db.prepare('UPDATE planned_work SET completed = 1, work_log_id = ? WHERE id = ?')
        .run(result.lastInsertRowid, id);

      updatedEntry = db.prepare('SELECT * FROM planned_work WHERE id = ?').get(id);
    } else {
      // Unchecking — remove the linked work_log entry if it exists
      if (entry.work_log_id) {
        db.prepare('DELETE FROM work_log WHERE id = ?').run(entry.work_log_id);
      }

      db.prepare('UPDATE planned_work SET completed = 0, work_log_id = NULL WHERE id = ?').run(id);
      updatedEntry = db.prepare('SELECT * FROM planned_work WHERE id = ?').get(id);
    }

    res.json(updatedEntry);
  } catch (err) {
    console.error('Error updating planned work entry:', err);
    res.status(500).json({ error: 'Failed to update planned work entry' });
  }
});

// DELETE /api/planned-work/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  try {
    const result = db.prepare('DELETE FROM planned_work WHERE id = ?').run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'Entry not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting planned work entry:', err);
    res.status(500).json({ error: 'Failed to delete planned work entry' });
  }
});

module.exports = router;
