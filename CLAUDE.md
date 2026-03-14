# docker-lawncare — AI Assistant Guide

## Architecture

Single Docker container running two processes under supervisord:

| Process | Language | File | Role |
|---------|----------|------|------|
| `app` | Node.js / Express | `backend/src/` | REST API + serves React frontend |
| `collector` | Python | `collector/collector.py` | Weather data collection (Visual Crossing API) |

Shared SQLite database at `/app/data/lawncare.db` (persisted volume).

Frontend is a React/Vite SPA built at image build time and served as static files by the backend.

---

## Database Migrations — Critical Rules

**`db.js` owns the schema. `collector.py` never creates or alters tables.**

Migrations are versioned using SQLite's `PRAGMA user_version`. Each migration runs exactly once.

### To add a new migration

Open `backend/src/db.js` and append to the `migrations` array:

```js
// v6 — describe what this adds and why
() => db.exec('ALTER TABLE some_table ADD COLUMN new_col TEXT'),
```

Rules:
1. **Never modify an existing migration** — only append new ones
2. **Each entry is one version** — the version number is its index + 1
3. **Wrap multi-statement migrations** in `db.transaction(...)()` if they must be atomic
4. **`collector.py` must not touch schema** — if the collector needs a new table or column, add it in `db.js` as a migration

### What you can and can't do

| Operation | How |
|-----------|-----|
| Add a column | `ALTER TABLE t ADD COLUMN col TYPE` — safe, append as new migration |
| Add a table | `CREATE TABLE new_table (...)` — safe, append as new migration |
| Rename a column | Requires recreate pattern — see SQLite docs, append as new migration |
| Change column type | Requires recreate pattern — append as new migration |
| Drop a column | Requires recreate pattern — append as new migration |
| Backfill data | Add a follow-up migration that runs `UPDATE` after the schema change |

### Legacy DB detection

DBs that existed before versioned migrations were introduced have `user_version = 0`.
`db.js` detects this by checking for the `settings` table and fast-forwards them to the current version (all prior migrations were already applied via the old try/catch pattern).

---

## Inter-process Communication

The two processes share the filesystem and SQLite database:

- **Trigger file** — `db.js` writes `/app/data/.collect-trigger` when the user saves settings with an API key. The collector polls for this file every 5 seconds.
- **`collector_log` table** — the collector writes progress rows here; the backend streams them to the frontend via SSE (`GET /api/status/stream`).

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET/PUT | `/api/settings` | User settings (lat, long, API key, targets) |
| GET | `/api/weather/history` | Historical weather with soil temp |
| GET | `/api/weather/forecast` | 7-day forecast |
| GET | `/api/weather/gdd` | Growing degree days |
| GET | `/api/weather/predictions` | GDD projections + threshold crossings |
| GET | `/api/weather/dollar-spot` | Smith-Kerns disease model |
| GET | `/api/weather/growth-potential` | PACE Turf growth potential |
| GET/POST/DELETE | `/api/worklog` | Work log CRUD |
| GET | `/api/status/position` | Current max collector_log ID (SSE setup) |
| GET | `/api/status/stream` | SSE stream of collector progress |

---

## Key Behaviours

- **First run**: settings are empty; the collector skips all collection until the user saves an API key + location in the Settings tab.
- **On settings save**: if the API key field is non-empty, the backend writes the trigger file and returns `{ backfillTriggered: true }`. The frontend opens an SSE connection to show live progress.
- **Backfill**: runs monthly chunks from Jan 1, most recent first, with 2s delay between chunks to avoid rate limiting. Skips months already fully populated.
- **Daily collection**: scheduled at 06:00 via the `schedule` library.

---

## Environment Variables

Only infrastructure variables are used — user configuration lives in the DB.

| Variable | Where used | Purpose |
|----------|-----------|---------|
| `DATA_DIR` | backend + collector | Path to data directory (default `/app/data`) |
| `PORT` | backend | Express port (default `3000`) |
| `PUID` / `PGID` | entrypoint.sh | Map container user to host UID/GID |

`VISUAL_CROSSING_API_KEY`, `LAT`, `LONG` are **not read from environment**. Set them in the Settings tab.
