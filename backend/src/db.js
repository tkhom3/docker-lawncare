const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'lawncare.db'));
db.pragma('journal_mode = WAL');

// ---------------------------------------------------------------------------
// Versioned migrations
//
// RULES FOR FUTURE CHANGES:
//   1. Never modify an existing migration — append a new one.
//   2. Each migration runs exactly once, tracked via PRAGMA user_version.
//   3. Wrap multi-statement migrations in db.transaction(...)().
//   4. collector.py does NOT own schema — only db.js does.
//
// Current version = migrations.length (auto-incremented as you add entries).
// ---------------------------------------------------------------------------

const migrations = [
  // v1 — initial schema
  () => db.exec(`
    CREATE TABLE IF NOT EXISTS weather_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      date        TEXT UNIQUE NOT NULL,
      temp_avg    REAL,
      temp_high   REAL,
      temp_low    REAL,
      humidity    REAL,
      precip      REAL,
      source      TEXT DEFAULT 'VC',
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS weather_forecast (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      date        TEXT UNIQUE NOT NULL,
      temp_high   REAL,
      temp_low    REAL,
      humidity    REAL,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS work_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      date        TEXT NOT NULL,
      activity    TEXT NOT NULL,
      notes       TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `),

  // v2 — add soil_temp to weather_history
  () => db.exec('ALTER TABLE weather_history ADD COLUMN soil_temp REAL'),

  // v3 — add precip to weather_forecast
  () => db.exec('ALTER TABLE weather_forecast ADD COLUMN precip REAL'),

  // v4 — add nutrient / product columns to work_log
  () => db.exec(`
    ALTER TABLE work_log ADD COLUMN n_pct            REAL;
    ALTER TABLE work_log ADD COLUMN p_pct            REAL;
    ALTER TABLE work_log ADD COLUMN k_pct            REAL;
    ALTER TABLE work_log ADD COLUMN fe_pct           REAL;
    ALTER TABLE work_log ADD COLUMN s_pct            REAL;
    ALTER TABLE work_log ADD COLUMN lbs_applied      REAL;
    ALTER TABLE work_log ADD COLUMN spreader_setting TEXT;
  `),

  // v5 — add collector_log for SSE progress streaming
  () => db.exec(`
    CREATE TABLE IF NOT EXISTS collector_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      level      TEXT NOT NULL,
      message    TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `),

  // v6 — add soil_tests table
  () => db.exec(`
    CREATE TABLE IF NOT EXISTS soil_tests (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      date       TEXT NOT NULL,
      notes      TEXT,
      ph         REAL,
      om_pct     REAL,
      p_ppm      REAL,
      k_ppm      REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `),

  // v7 — add planned_work table for scheduling future applications
  () => db.exec(`
    CREATE TABLE IF NOT EXISTS planned_work (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      planned_date     TEXT NOT NULL,
      activity         TEXT NOT NULL,
      notes            TEXT,
      n_pct            REAL,
      p_pct            REAL,
      k_pct            REAL,
      fe_pct           REAL,
      s_pct            REAL,
      lbs_planned      REAL,
      spreader_setting TEXT,
      completed        INTEGER NOT NULL DEFAULT 0,
      created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `),

  // v8 — link planned_work to the work_log entry created on completion
  () => db.exec('ALTER TABLE planned_work ADD COLUMN work_log_id INTEGER REFERENCES work_log(id)'),
];

// ---------------------------------------------------------------------------
// Migration runner
//
// Legacy DBs (user_version = 0) may already have some schema applied via the
// old try/catch pattern. We detect this by checking for the settings table:
//   - settings table missing  → truly fresh install, start from v0
//   - settings table present  → legacy DB, fast-forward to current version
//     (all prior migrations are idempotent CREATE TABLE IF NOT EXISTS or
//      ALTER TABLE ADD COLUMN ops that already succeeded on that DB)
// ---------------------------------------------------------------------------

let currentVersion = db.pragma('user_version', { simple: true });

if (currentVersion === 0) {
  const hasSettings = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'")
    .get();

  if (hasSettings) {
    // Legacy DB — schema already applied, just stamp it at current version
    db.pragma(`user_version = ${migrations.length}`);
    currentVersion = migrations.length;
  }
}

for (let v = currentVersion; v < migrations.length; v++) {
  db.transaction(() => {
    migrations[v]();
    db.pragma(`user_version = ${v + 1}`);
  })();
  console.log(`DB migration applied: v${v + 1}`);
}

// ---------------------------------------------------------------------------
// Seed default settings rows (INSERT OR IGNORE — never overwrites)
// ---------------------------------------------------------------------------

const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const key of ['lat', 'long', 'lawn_sqft', 'vc_api_key', 'n_target', 'p_target', 'k_target', 'fe_target', 's_target']) {
  insert.run(key, '');
}

module.exports = db;
