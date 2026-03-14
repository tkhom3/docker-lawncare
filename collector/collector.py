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

DATA_DIR = os.environ.get('DATA_DIR', '/app/data')
DB_PATH = os.path.join(DATA_DIR, 'lawncare.db')


def get_settings():
    """Return (api_key, lat, long) from DB. Returns empty strings if not configured."""
    try:
        conn = sqlite3.connect(DB_PATH)
        rows = conn.execute(
            "SELECT key, value FROM settings WHERE key IN ('vc_api_key', 'lat', 'long')"
        ).fetchall()
        conn.close()
        s = {r[0]: r[1] for r in rows}
        return (
            s.get('vc_api_key', '').strip(),
            s.get('lat', '').strip(),
            s.get('long', '').strip(),
        )
    except Exception as e:
        logger.error(f'Failed to read settings from DB: {e}')
        return '', '', ''


def write_log(level, message):
    """Write a status entry to collector_log for the frontend SSE stream."""
    logger.info(f'[{level.upper()}] {message}')
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            'INSERT INTO collector_log (level, message) VALUES (?, ?)',
            (level, message),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning(f'Failed to write log entry: {e}')


def get_db():
    """Open the SQLite database. Schema is managed exclusively by db.js (Node backend)."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    return conn


def fetch_chunk(api_key, lat, long_, start_date, end_date, conn):
    """
    Fetch a single date range from Visual Crossing and insert into weather_history.
    Returns (inserted, error_message_or_None).
    """
    start_str = start_date.strftime('%Y-%m-%d')
    end_str = end_date.strftime('%Y-%m-%d')
    url = (
        f'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services'
        f'/weatherdata/history'
        f'?aggregateHours=24'
        f'&startDateTime={start_str}T00:00:00'
        f'&endDateTime={end_str}T23:58:00'
        f'&contentType=json'
        f'&locationMode=single'
        f'&locations={lat},{long_}'
        f'&unitGroup=metric'
        f'&collectStationContribution=true'
        f'&key={api_key}'
    )
    try:
        resp = requests.get(url, timeout=60)
        if resp.status_code == 429:
            return 0, '429 rate limit — try again tomorrow'
        if not resp.ok:
            return 0, f'HTTP {resp.status_code}: {resp.text[:100]}'

        data = resp.json()
        values = data.get('location', {}).get('values', [])
        if not values:
            return 0, None

        inserted = 0
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
        conn.commit()
        return inserted, None

    except requests.RequestException as e:
        return 0, str(e)


def backfill_history(log_progress=False):
    """
    Fetch weather history from Jan 1 of the current year in monthly chunks,
    processing most recent months first. Skips months already fully populated.
    """
    API_KEY, LAT, LONG = get_settings()
    if not API_KEY:
        if log_progress:
            write_log('warning', 'API key not set — skipping backfill.')
        else:
            logger.warning(
                'VISUAL_CROSSING_API_KEY not set, skipping backfill.')
        return

    today = datetime.now().date()
    start_of_year = today.replace(month=1, day=1)
    yesterday = today - timedelta(days=1)

    if yesterday < start_of_year:
        return  # Nothing to backfill (first day of year)

    # Build monthly chunks, most recent first
    chunks = []
    chunk_end = yesterday
    while chunk_end >= start_of_year:
        chunk_start = chunk_end.replace(day=1)
        if chunk_start < start_of_year:
            chunk_start = start_of_year
        chunks.append((chunk_start, chunk_end))
        chunk_end = chunk_start - timedelta(days=1)

    if log_progress:
        write_log(
            'info', f'Checking {len(chunks)} month(s) of history ({start_of_year} → {yesterday})...')

    conn = get_db()
    try:
        for i, (chunk_start, chunk_end) in enumerate(chunks):
            month_label = chunk_start.strftime('%b %Y')
            days_in_chunk = (chunk_end - chunk_start).days + 1

            # Skip if all days in this chunk are already in the DB
            existing = conn.execute(
                'SELECT COUNT(*) FROM weather_history WHERE date >= ? AND date <= ?',
                (chunk_start.isoformat(), chunk_end.isoformat()),
            ).fetchone()[0]

            if existing >= days_in_chunk:
                logger.info(
                    f'Backfill: {month_label} already complete, skipping.')
                if log_progress:
                    write_log('info', f'{month_label}: already complete.')
                continue

            logger.info(
                f'Backfill: fetching {month_label} ({chunk_start} to {chunk_end})...')
            if log_progress:
                write_log('info', f'Fetching {month_label}...')

            inserted, error = fetch_chunk(
                API_KEY, LAT, LONG, chunk_start, chunk_end, conn)

            if error:
                logger.error(f'Backfill {month_label}: {error}')
                if log_progress:
                    write_log('error', f'{month_label}: {error}')
                if '429' in error:
                    if log_progress:
                        write_log(
                            'warning', 'Rate limited — remaining months will retry on next collection.')
                    break
            else:
                logger.info(
                    f'Backfill {month_label}: {inserted} new day(s) added.')
                if log_progress:
                    write_log(
                        'info', f'{month_label}: {inserted} new day(s) added.')

            # Pause between chunks to avoid rate limits
            if i < len(chunks) - 1:
                time.sleep(2)
    finally:
        conn.close()


def fetch_history():
    """Fetch yesterday's historical weather data from Visual Crossing."""
    API_KEY, LAT, LONG = get_settings()
    if not API_KEY:
        logger.warning(
            'VISUAL_CROSSING_API_KEY not set, skipping history fetch.')
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
        logger.info(f'Fetching history for {yesterday}...')
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
                logger.info(
                    f'History already exists for {yesterday}, skipped.')
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
        logger.warning(
            'VISUAL_CROSSING_API_KEY not set, skipping forecast fetch.')
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
        logger.info(f'Fetching forecast...')
        resp = requests.get(url, timeout=30)
        if not resp.ok:
            logger.error(
                f'Forecast HTTP {resp.status_code}: {resp.text[:200]}')
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
                    date_str = datetime.fromtimestamp(
                        epoch_sec, tz=timezone.utc).strftime('%Y-%m-%d')
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
    """Run history and forecast collection."""
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
            logger.info(
                f'Waiting for database... (attempt {attempt}/{retries})')
            time.sleep(delay)
    logger.error('Database not ready after maximum retries.')
    return False


if __name__ == '__main__':
    logger.info('Lawncare collector starting up.')
    logger.info(f'Data directory: {DATA_DIR}')

    if not wait_for_db():
        sys.exit(1)

    api_key, lat, long_ = get_settings()
    if api_key and lat and long_:
        logger.info(f'Location: {lat}, {long_}')
        logger.info('API key: set')
    else:
        logger.info(
            'Settings not configured — waiting for user to set them in the Settings page.')

    backfill_history(log_progress=False)
    run_collection()

    # Schedule daily at 00:00
    schedule.every().day.at('00:00').do(run_collection)
    logger.info('Scheduled daily collection at 00:00. Waiting...')

    while True:
        schedule.run_pending()
        # Check for trigger file written by the app when settings are saved
        if os.path.exists(TRIGGER_FILE):
            try:
                os.remove(TRIGGER_FILE)
            except OSError:
                pass
            logger.info('Trigger file detected — running collection now.')
            write_log('info', 'Settings saved — starting data collection...')
            backfill_history(log_progress=True)
            run_collection()
            write_log('done', 'All done! Reload the page to see your data.')
        time.sleep(5)
