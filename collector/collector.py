import os
import sys
import sqlite3
import logging
import schedule
import time
import requests
from datetime import datetime, timedelta, timezone

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

# Config from environment (used as fallbacks if not set in DB)
DATA_DIR = os.environ.get('DATA_DIR', '/app/data')
DB_PATH = os.path.join(DATA_DIR, 'lawncare.db')

_ENV_API_KEY = os.environ.get('VISUAL_CROSSING_API_KEY', '')
_ENV_LAT = os.environ.get('LAT', '40.7128')
_ENV_LONG = os.environ.get('LONG', '-74.0060')


def get_settings():
    """Return (api_key, lat, long) from DB, falling back to env vars."""
    try:
        conn = sqlite3.connect(DB_PATH)
        rows = conn.execute(
            "SELECT key, value FROM settings WHERE key IN ('vc_api_key', 'lat', 'long')"
        ).fetchall()
        conn.close()
        s = {r[0]: r[1] for r in rows}
        return (
            s.get('vc_api_key', '').strip() or _ENV_API_KEY,
            s.get('lat', '').strip() or _ENV_LAT,
            s.get('long', '').strip() or _ENV_LONG,
        )
    except Exception as e:
        logger.error(f'Failed to read settings from DB, falling back to env vars: {e}')
        return _ENV_API_KEY, _ENV_LAT, _ENV_LONG


def get_db():
    """Open the SQLite database and ensure tables exist."""
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    conn.executescript("""
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
    """)
    conn.commit()
    # Migrations
    try:
        conn.execute('ALTER TABLE weather_history ADD COLUMN soil_temp REAL')
        conn.commit()
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute('ALTER TABLE weather_forecast ADD COLUMN precip REAL')
        conn.commit()
    except sqlite3.OperationalError:
        pass
    return conn


def backfill_history(days=30):
    """Fetch up to `days` days of history and insert any missing rows."""
    API_KEY, LAT, LONG = get_settings()
    if not API_KEY:
        logger.warning('VISUAL_CROSSING_API_KEY not set, skipping backfill.')
        return

    start = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
    end = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
    url = (
        f'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services'
        f'/weatherdata/history'
        f'?aggregateHours=24'
        f'&startDateTime={start}T00:00:00'
        f'&endDateTime={end}T23:58:00'
        f'&contentType=json'
        f'&locationMode=single'
        f'&locations={LAT},{LONG}'
        f'&unitGroup=metric'
        f'&collectStationContribution=true'
        f'&key={API_KEY}'
    )

    try:
        logger.info(f'Backfilling history from {start} to {end} for {LAT},{LONG}...')
        resp = requests.get(url, timeout=60)
        if not resp.ok:
            logger.error(f'Backfill HTTP {resp.status_code}: {resp.text[:200]}')
            resp.raise_for_status()
        data = resp.json()

        values = data.get('location', {}).get('values', [])
        if not values:
            logger.warning('No values returned during backfill.')
            return

        conn = get_db()
        inserted = 0
        skipped = 0
        try:
            for row in values:
                raw_dt = row.get('datetimeStr') or row.get('datetime')
                if raw_dt is None:
                    continue
                date_str = str(raw_dt)[:10]
                cursor = conn.execute(
                    """
                    INSERT OR IGNORE INTO weather_history
                        (date, temp_avg, temp_high, temp_low, humidity, precip, source)
                    VALUES (?, ?, ?, ?, ?, ?, 'VC')
                    """,
                    (date_str, row.get('temp'), row.get('maxt'), row.get('mint'),
                     row.get('humidity'), row.get('precip')),
                )
                if cursor.rowcount:
                    inserted += 1
                else:
                    skipped += 1
            conn.commit()
        finally:
            conn.close()

        logger.info(f'Backfill complete: {inserted} inserted, {skipped} already existed.')

    except requests.RequestException as e:
        logger.error(f'HTTP error during backfill: {e}')
    except (KeyError, IndexError, ValueError) as e:
        logger.error(f'Parse error during backfill: {e}')


def fetch_history():
    """Fetch yesterday's historical weather data from Visual Crossing."""
    API_KEY, LAT, LONG = get_settings()
    if not API_KEY:
        logger.warning('VISUAL_CROSSING_API_KEY not set, skipping history fetch.')
        return

    yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
    url = (
        f'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services'
        f'/weatherdata/history'
        f'?aggregateHours=24'
        f'&startDateTime={yesterday}T00:00:00'
        f'&endDateTime={yesterday}T23:58:00'
        f'&contentType=json'
        f'&locationMode=single'
        f'&locations={LAT},{LONG}'
        f'&unitGroup=metric'
        f'&collectStationContribution=true'
        f'&key={API_KEY}'
    )

    try:
        logger.info(f'Fetching history for {yesterday} ({LAT},{LONG})...')
        resp = requests.get(url, timeout=30)
        if not resp.ok:
            logger.error(f'History HTTP {resp.status_code}: {resp.text[:200]}')
            resp.raise_for_status()
        data = resp.json()

        values = data.get('location', {}).get('values', [])
        if not values:
            logger.warning(f'No history values returned for {yesterday}')
            return

        row = values[0]
        humidity = row.get('humidity')
        temp_high = row.get('maxt')
        temp_low = row.get('mint')
        temp_avg = row.get('temp')
        precip = row.get('precip')

        conn = get_db()
        try:
            cursor = conn.execute(
                """
                INSERT OR IGNORE INTO weather_history
                    (date, temp_avg, temp_high, temp_low, humidity, precip, source)
                VALUES (?, ?, ?, ?, ?, ?, 'VC')
                """,
                (yesterday, temp_avg, temp_high, temp_low, humidity, precip),
            )
            conn.commit()
            if cursor.rowcount:
                logger.info(
                    f'History saved: {yesterday} | avg={temp_avg}°C high={temp_high}°C '
                    f'low={temp_low}°C humidity={humidity}% precip={precip}mm'
                )
            else:
                logger.info(f'History already exists for {yesterday}, skipped.')
        finally:
            conn.close()

    except requests.RequestException as e:
        logger.error(f'HTTP error fetching history: {e}')
    except (KeyError, IndexError, ValueError) as e:
        logger.error(f'Parse error fetching history: {e}')


def fetch_forecast():
    """Fetch upcoming forecast data from Visual Crossing."""
    API_KEY, LAT, LONG = get_settings()
    if not API_KEY:
        logger.warning('VISUAL_CROSSING_API_KEY not set, skipping forecast fetch.')
        return

    url = (
        f'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services'
        f'/weatherdata/forecast'
        f'?aggregateHours=24'
        f'&contentType=json'
        f'&locationMode=single'
        f'&locations={LAT},{LONG}'
        f'&unitGroup=metric'
        f'&key={API_KEY}'
    )

    try:
        logger.info(f'Fetching forecast ({LAT},{LONG})...')
        resp = requests.get(url, timeout=30)
        if not resp.ok:
            logger.error(f'Forecast HTTP {resp.status_code}: {resp.text[:200]}')
            resp.raise_for_status()
        data = resp.json()

        values = data.get('location', {}).get('values', [])
        if not values:
            logger.warning('No forecast values returned')
            return

        conn = get_db()
        try:
            inserted = 0
            for entry in values[:8]:
                raw_dt = entry.get('datetime')
                if raw_dt is None:
                    continue
                try:
                    epoch_sec = int(raw_dt)
                    if epoch_sec > 1e10:
                        epoch_sec = epoch_sec // 1000
                    date_str = datetime.fromtimestamp(epoch_sec, tz=timezone.utc).strftime('%Y-%m-%d')
                except (TypeError, ValueError, OSError):
                    date_str = str(raw_dt)[:10]

                conn.execute(
                    """
                    INSERT OR REPLACE INTO weather_forecast
                        (date, temp_high, temp_low, humidity, precip, updated_at)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    (date_str, entry.get('maxt'), entry.get('mint'),
                     entry.get('humidity'), entry.get('precip')),
                )
                inserted += 1

            conn.commit()
            logger.info(f'Forecast updated: {inserted} days stored.')
        finally:
            conn.close()

    except requests.RequestException as e:
        logger.error(f'HTTP error fetching forecast: {e}')
    except (KeyError, IndexError, ValueError) as e:
        logger.error(f'Parse error fetching forecast: {e}')


def run_collection():
    """Run history, forecast, and soil temp collection."""
    logger.info('--- Starting data collection ---')
    try:
        fetch_history()
    except Exception as e:
        logger.error(f'Unexpected error in fetch_history: {e}')

    try:
        fetch_forecast()
    except Exception as e:
        logger.error(f'Unexpected error in fetch_forecast: {e}')

    logger.info('--- Collection complete ---')


TRIGGER_FILE = os.path.join(DATA_DIR, '.collect-trigger')


def wait_for_db(retries=10, delay=3):
    """Wait for the app container to initialize the DB before starting."""
    for attempt in range(1, retries + 1):
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.execute("SELECT 1 FROM settings LIMIT 1")
            conn.close()
            return True
        except Exception:
            logger.info(f'Waiting for database... (attempt {attempt}/{retries})')
            time.sleep(delay)
    logger.error('Database not ready after maximum retries.')
    return False


if __name__ == '__main__':
    logger.info('Lawncare collector starting up.')
    logger.info(f'Data directory: {DATA_DIR}')

    if not wait_for_db():
        sys.exit(1)

    api_key, lat, long_ = get_settings()
    logger.info(f'Location: {lat}, {long_}')
    logger.info(f'API key: {"set" if api_key else "NOT SET — set it in the Settings page"}')

    # Backfill from Jan 1 of current year on startup
    jan1 = datetime(datetime.now().year, 1, 1)
    days_since_jan1 = (datetime.now() - jan1).days
    backfill_history(days=days_since_jan1)

    # Run immediately on startup
    run_collection()

    # Schedule daily at 6:00 AM
    schedule.every().day.at('06:00').do(run_collection)
    logger.info('Scheduled daily collection at 06:00. Waiting...')

    while True:
        schedule.run_pending()
        # Check for trigger file written by the app when settings are saved
        if os.path.exists(TRIGGER_FILE):
            try:
                os.remove(TRIGGER_FILE)
            except OSError:
                pass
            logger.info('Trigger file detected — running collection now.')
            backfill_history(days=(datetime.now() - datetime(datetime.now().year, 1, 1)).days)
            run_collection()
        time.sleep(60)
