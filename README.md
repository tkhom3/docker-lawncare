# docker-lawncare

Web dashboard for tracking lawn health, maintenance activities, and nutrient applications. Designed for cool-season grasses in the Midwest with weather tracking and nutrient management.

## Features

### 📋 Work Log

- **Log maintenance activities** with detailed product information:
  - Nutrient percentages (Nitrogen, Phosphorus, Potassium, Iron, Sulfur)
  - Pounds applied
  - Spreader settings
- **Automatic calculations**:
  - Total nutrients applied (lbs)
  - Nutrients per 1000 sq ft
  - Tracked against yearly targets

### 📊 Yearly Nutrient Summary

- **Progress gauges** for each nutrient tracking toward annual targets
- **Visual indicators** showing percentage of goal completed
- **Real-time updates** as new work log entries are added
- Helps manage nutrient applications throughout the growing season

### ⚙️ Settings

- **Property Configuration**:
  - Lawn size (sq ft) for per-1000-sqft calculations
  - Location (latitude/longitude) for weather data
- **Yearly Nutrient Targets**:
  - Set targets for N, P, K, Fe, S
  - **Smart recommendations** based on lawn size (optimized for cool-season Midwest grasses)
  - One-click "Apply Recommendations" button
- **API Keys**:
  - Visual Crossing API for weather data collection

### 🌤️ Weather

- **Historical weather data** with temperature, humidity, precipitation
- **7-day forecast** from Visual Crossing API
- **Soil temperature tracking** when available
- **GDD (Growing Degree Days)** calculations for turf management

### 📈 Predictions

- **Prediction cards** for turf disease pressure (Dollar Spot, Gray Leaf Spot)
- **Progress tracking** toward historical event dates
- Based on weather conditions and historical patterns

## Quick Start

### Local Development (Linux, macOS, Windows)

**Prerequisites:** Docker and Docker Compose

1. Copy the example env file:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your configuration:
   - `LAWNCARE_DATA_PATH` — where to store persistent data (defaults to `./data`)
   - `VISUAL_CROSSING_API_KEY` — get free key at [visualcrossing.com](https://www.visualcrossing.com/)
   - `LAT` / `LONG` — latitude and longitude of your location

3. Start the app:

   ```bash
   docker compose up --build
   ```

4. Open [http://localhost:3000](http://localhost:3000)

### Running on Unraid

1. **Create a data directory** on a share:
   - Use Unraid's file manager or terminal
   - Suggested path: `/mnt/user/lawncare-data` or `/mnt/cache/lawncare-data`
   - Make sure the directory exists before starting the container
   - **Important**: Ensure the directory is writable. If created by root, run:
     ```bash
     chmod 755 /mnt/user/lawncare-data
     ```

2. **Create/Update .env file**:

   ```bash
   cat > .env << 'EOF'
   LAWNCARE_DATA_PATH=/mnt/user/lawncare-data
   VISUAL_CROSSING_API_KEY=your_api_key_here
   LAT=your_latitude
   LONG=your_longitude
   EOF
   ```

3. **Start with Docker Compose**:

   ```bash
   docker compose up --build
   ```

4. **Access the dashboard**: `http://your-unraid-ip:3000`

5. **Data persistence**: Your database and settings are stored in the directory you specified in `LAWNCARE_DATA_PATH`, which survives container restarts and updates.

   **Note**: Containers run as non-root user (UID 10001) for security. The data directory must be readable and writable by this user.

## Architecture

- **Frontend**: React + Vite (port 3000)
- **Backend**: Node.js Express API (included in same container)
- **Database**: SQLite (persisted to host filesystem)
- **Collector**: Python service that fetches weather data daily at 6:00 AM

The `collector` service runs in the background and periodically fetches weather data from Visual Crossing API.

## Persistent Data

All application data (database, settings, work logs) is stored in the directory specified by `LAWNCARE_DATA_PATH`:

- SQLite database: `lawncare.db`
- Container path: `/app/data`
- Host path: Configurable via `LAWNCARE_DATA_PATH` environment variable

Data survives container restarts and updates as long as you map the volume correctly.

## Recommended Nutrient Targets (Cool Season Grass - Midwest)

The app includes smart recommendations for cool-season Midwest lawns based on lawn size. For reference, here are the standards:

For every **1,000 sq ft** of lawn, apply annually:

- **Nitrogen (N)**: 16 lbs
- **Phosphorus (P)**: 2.5 lbs
- **Potassium (K)**: 5 lbs
- **Iron (Fe)**: 0.3 lbs
- **Sulfur (S)**: 1 lb

**Example for 5,000 sq ft lawn:**

- N: 80 lbs | P: 12.5 lbs | K: 25 lbs | Fe: 1.5 lbs | S: 5 lbs

Enter your lawn size in Settings and click "Apply Recommendations" to get custom targets.

## Stopping the Application

To stop the containers:

```bash
docker compose down
```

To view logs:

```bash
docker compose logs -f app
docker compose logs -f collector
```

## Development

The app consists of four services:

- **app**: Web server (Node.js + Express) with React frontend
- **collector**: Weather data collector (Python)

Both share a SQLite database persisted to disk.

### Frontend Stack

- React 18
- Vite
- Chart.js for visualizations

### Backend Stack

- Node.js + Express
- better-sqlite3
- API endpoints for weather, work logs, and settings

### Database Schema

- `work_log` — maintenance activities with nutrient details
- `weather_history` — historical weather data
- `weather_forecast` — 7-day forecasts
- `settings` — user configuration and targets

## Releases & Deployment

This project uses **automatic semantic versioning** to manage releases and Docker Hub deployments.

### Release Process

Releases are created automatically based on commit messages using [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

**Commit types and version bumps:**

| Type               | Version | Example                                 |
| ------------------ | ------- | --------------------------------------- |
| `feat:`            | Minor   | `feat: add yearly nutrient summary`     |
| `fix:`             | Patch   | `fix: correct calculation logic`        |
| `perf:`            | Patch   | `perf: optimize database queries`       |
| `docs:`            | No tag  | `docs: update README`                   |
| `BREAKING CHANGE:` | Major   | `feat: new API\n\nBREAKING CHANGE: ...` |

**Examples:**

```bash
# Creates patch release (v1.0.1)
git commit -m "fix: correct nutrient calculation rounding"

# Creates minor release (v1.1.0)
git commit -m "feat: add daily nutrient summary email"

# Creates major release (v2.0.0)
git commit -m "feat: redesigned dashboard layout

BREAKING CHANGE: Settings structure has changed"
```

### Docker Hub Deployment

When a release is created, Docker images are automatically built and pushed to Docker Hub with:

- `latest` tag (always points to newest release)
- Version tag (e.g., `v1.2.3`)

For complete deployment setup instructions, see [DEPLOY.md](DEPLOY.md).

### Development Workflow

1. **Feature branches**: Create a branch for your feature or fix
2. **Conventional commits**: Use conventional commit messages for all commits
3. **Pull request**: Submit PR for review
4. **Merge to main**: Approved PRs are merged to main
5. **Automatic release**: Semantic-release analyzes commits and creates a release
6. **Docker build**: Images are built and pushed to Docker Hub automatically
7. **Deploy**: Pull new images on production (Unraid or other hosts)

### More Information

- **Complete deployment guide**: See [DEPLOY.md](DEPLOY.md) for Docker Hub setup and troubleshooting
- **Version history**: Check [CHANGELOG.md](CHANGELOG.md) for all releases and changes
- **GitHub Releases**: View releases at `/releases` on GitHub
# Test\n
