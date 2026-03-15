const fs   = require('fs');
const path = require('path');
const db   = require('./db');

const DATA_DIR   = process.env.DATA_DIR || path.join(__dirname, '../../data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const KEEP       = parseInt(process.env.BACKUP_KEEP ?? '4', 10);

const DAY_NAMES  = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const BACKUP_DAY = (() => {
  const raw = (process.env.BACKUP_DAY ?? 'sunday').toLowerCase().trim();
  const idx = DAY_NAMES.indexOf(raw);
  if (idx !== -1) return idx;
  const n = parseInt(raw, 10);
  if (n >= 0 && n <= 6) return n;
  console.warn(`[backup] Unknown BACKUP_DAY "${raw}", defaulting to Sunday`);
  return 0;
})();

const BACKUP_TIME = (() => {
  const raw = process.env.BACKUP_TIME ?? '00:00';
  const [h, m] = raw.split(':').map(Number);
  return { h: h || 0, m: m || 0 };
})();

// Returns ms until the next occurrence of (BACKUP_DAY, BACKUP_TIME)
function msUntilNext() {
  const now  = new Date();
  const next = new Date(now);
  next.setHours(BACKUP_TIME.h, BACKUP_TIME.m, 0, 0);

  const daysAhead = (BACKUP_DAY - now.getDay() + 7) % 7;
  // If today is the target day but the time has already passed, roll to next week
  next.setDate(now.getDate() + (daysAhead === 0 && next <= now ? 7 : daysAhead));

  return next - now;
}

async function runBackup() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const dest = path.join(BACKUP_DIR, `lawncare_${timestamp}.db`);

  await db.backup(dest);
  console.log(`[backup] Saved → ${dest}`);

  // Prune old backups, keep the most recent KEEP files
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('lawncare_') && f.endsWith('.db'))
    .sort();
  for (const old of files.slice(0, -KEEP)) {
    fs.unlinkSync(path.join(BACKUP_DIR, old));
    console.log(`[backup] Removed old backup: ${old}`);
  }
}

function scheduleNext() {
  const ms = msUntilNext();
  const nextDate = new Date(Date.now() + ms);
  console.log(`[backup] Next backup scheduled for ${nextDate.toLocaleString()}`);
  setTimeout(() => {
    runBackup()
      .catch(e => console.error('[backup] Failed:', e))
      .finally(() => scheduleNext());
  }, ms);
}

function scheduleBackups() {
  const dayName = DAY_NAMES[BACKUP_DAY];
  const timeStr = `${String(BACKUP_TIME.h).padStart(2,'0')}:${String(BACKUP_TIME.m).padStart(2,'0')}`;
  console.log(`[backup] Scheduled every ${dayName} at ${timeStr}, keeping last ${KEEP} backups`);
  scheduleNext();
}

module.exports = { scheduleBackups };
