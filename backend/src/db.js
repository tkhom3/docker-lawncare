const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'lawncare.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS weather_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    temp_avg REAL,
    temp_high REAL,
    temp_low REAL,
    humidity REAL,
    precip REAL,
    source TEXT DEFAULT 'VC',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS weather_forecast (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    temp_high REAL,
    temp_low REAL,
    humidity REAL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS work_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    activity TEXT NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migrations
try {
  db.exec('ALTER TABLE weather_history ADD COLUMN soil_temp REAL');
} catch (_) {}

try {
  db.exec('ALTER TABLE weather_forecast ADD COLUMN precip REAL');
} catch (_) {}

// Work log product/nutrient columns
for (const [col, type] of [
  ['n_pct', 'REAL'], ['p_pct', 'REAL'], ['k_pct', 'REAL'],
  ['fe_pct', 'REAL'], ['s_pct', 'REAL'],
  ['lbs_applied', 'REAL'], ['spreader_setting', 'TEXT'],
]) {
  try { db.exec(`ALTER TABLE work_log ADD COLUMN ${col} ${type}`); } catch (_) {}
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  // Seed from env vars if not already set
  const insert = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  insert.run('lat', process.env.LAT || '');
  insert.run('long', process.env.LONG || '');
  insert.run('lawn_sqft', '');
  insert.run('vc_api_key', process.env.VISUAL_CROSSING_API_KEY || '');
  // Nutrient targets for the year
  insert.run('n_target', '');
  insert.run('p_target', '');
  insert.run('k_target', '');
  insert.run('fe_target', '');
  insert.run('s_target', '');
} catch (_) {}

module.exports = db;
