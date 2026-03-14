const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
const TRIGGER_FILE = path.join(DATA_DIR, '.collect-trigger');

// GET /api/settings
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = Object.fromEntries(
      rows.map(r => [
        r.key,
        r.key === 'vc_api_key' && r.value ? '••••••••' : r.value
      ])
    );
    res.json(settings);
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings
router.put('/', (req, res) => {
  try {
    // Allow updating these fields (vc_api_key excluded from UI edit)
    const allowed = ['lat', 'long', 'lawn_sqft', 'vc_api_key', 'n_target', 'p_target', 'k_target', 'fe_target', 's_target'];
    const upsert = db.prepare(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
    );
    const updateMany = db.transaction((updates) => {
      for (const [key, value] of Object.entries(updates)) {
        if (allowed.includes(key)) {
          // Skip writing back the masked placeholder or an empty value
          if (key === 'vc_api_key' && (!value || value === '••••••••')) continue;
          upsert.run(key, String(value));
        }
      }
    });
    updateMany(req.body);
    const rows = db.prepare('SELECT key, value FROM settings').all();

    // If API key was just saved, signal the collector to run immediately
    const apiKeyUpdated = req.body.vc_api_key && req.body.vc_api_key !== '••••••••';
    if (apiKeyUpdated) {
      try { fs.writeFileSync(TRIGGER_FILE, Date.now().toString()); } catch (_) {}
    }

    const settings = Object.fromEntries(
      rows.map(r => [r.key, r.key === 'vc_api_key' && r.value ? '••••••••' : r.value])
    );
    res.json({ ...settings, backfillTriggered: apiKeyUpdated });
  } catch (err) {
    console.error('Error saving settings:', err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

module.exports = router;
