const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/weather/history
// Includes soil_temp_est: 14-day rolling average of mean air temp (°C), a standard
// agronomic approximation of 4" soil temperature.
router.get('/history', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT *,
        AVG(temp_avg) OVER (
          ORDER BY date
          ROWS BETWEEN 13 PRECEDING AND CURRENT ROW
        ) AS soil_temp_est
      FROM weather_history
      ORDER BY date DESC
    `).all();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching weather history:', err);
    res.status(500).json({ error: 'Failed to fetch weather history' });
  }
});

// GET /api/weather/forecast
router.get('/forecast', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM weather_forecast ORDER BY date ASC').all();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching weather forecast:', err);
    res.status(500).json({ error: 'Failed to fetch weather forecast' });
  }
});

// GET /api/weather/gdd
router.get('/gdd', (req, res) => {
  try {
    const rows = db.prepare('SELECT date, temp_high, temp_low FROM weather_history ORDER BY date ASC').all();
    let cumulative = 0;
    const result = rows.map(row => {
      const highF = row.temp_high * 9 / 5 + 32;
      const lowF = row.temp_low * 9 / 5 + 32;
      const avgF = (highF + lowF) / 2;
      const gdd = Math.max(0, avgF - 50); // base 50°F
      cumulative += gdd;
      return {
        date: row.date,
        gdd: Math.round(gdd * 100) / 100,
        cumulative_gdd: Math.round(cumulative * 100) / 100
      };
    });
    res.json(result);
  } catch (err) {
    console.error('Error calculating GDD:', err);
    res.status(500).json({ error: 'Failed to calculate GDD' });
  }
});

// GET /api/weather/predictions
// Projects cumulative GDD forward using forecast data, then a 14-day trend
// extrapolation until all action thresholds are crossed.
router.get('/predictions', (req, res) => {
  const THRESHOLDS = [
    { gdd: 200, label: 'Pre-emergent herbicide', color: '#f59e0b' },
    { gdd: 300, label: 'Crabgrass germinating',  color: '#ef4444' },
    { gdd: 500, label: 'Spring fertilization',   color: '#3b82f6' },
  ];

  function toGdd(highC, lowC) {
    const avgF = (highC * 9/5 + 32 + lowC * 9/5 + 32) / 2;
    return Math.max(0, avgF - 50);
  }

  try {
    const histRows = db.prepare(
      'SELECT date, temp_high, temp_low FROM weather_history ORDER BY date ASC'
    ).all();
    const foreRows = db.prepare(
      'SELECT date, temp_high, temp_low FROM weather_forecast ORDER BY date ASC'
    ).all();

    // Build historical cumulative GDD
    let cumulative = 0;
    const history = histRows.map(row => {
      cumulative += toGdd(row.temp_high, row.temp_low);
      return { date: row.date, cumulative_gdd: Math.round(cumulative * 10) / 10 };
    });

    // Extend with forecast
    const forecast = foreRows.map(row => {
      cumulative += toGdd(row.temp_high, row.temp_low);
      return { date: row.date, cumulative_gdd: Math.round(cumulative * 10) / 10 };
    });

    // Average daily GDD over last 14 history days for extrapolation
    const recent = histRows.slice(-14);
    const avgDailyGdd = recent.reduce((s, r) => s + toGdd(r.temp_high, r.temp_low), 0)
      / Math.max(recent.length, 1);

    // Extrapolate day-by-day until all thresholds crossed (max 180 days)
    const maxThreshold = Math.max(...THRESHOLDS.map(t => t.gdd));
    const lastDate = new Date(
      forecast.length ? forecast[forecast.length - 1].date : history[history.length - 1].date
    );
    const estimated = [];
    let extCum = cumulative;
    let extDate = new Date(lastDate);
    for (let i = 0; i < 180 && extCum < maxThreshold; i++) {
      extDate.setDate(extDate.getDate() + 1);
      extCum = Math.round((extCum + avgDailyGdd) * 10) / 10;
      estimated.push({ date: extDate.toISOString().split('T')[0], cumulative_gdd: extCum });
    }

    // Find threshold crossing dates across all series
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const allPoints = [
      ...history.map(p => ({ ...p, series: 'history' })),
      ...forecast.map(p => ({ ...p, series: 'forecast' })),
      ...estimated.map(p => ({ ...p, series: 'estimated' })),
    ];
    const crossings = THRESHOLDS.map(threshold => {
      const hit = allPoints.find(p => p.cumulative_gdd >= threshold.gdd);
      if (!hit) return { ...threshold, date: null, daysUntil: null, series: null };
      const crossDate = new Date(hit.date);
      crossDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.round((crossDate - today) / 86400000);
      return { ...threshold, date: hit.date, daysUntil, series: hit.series };
    });

    res.json({ history, forecast, estimated, crossings, avgDailyGdd: Math.round(avgDailyGdd * 10) / 10 });
  } catch (err) {
    console.error('Error calculating predictions:', err);
    res.status(500).json({ error: 'Failed to calculate predictions' });
  }
});

// GET /api/weather/dollar-spot
// Smith-Kerns Dollar Spot Probability Model
// p = 1 / (1 + exp(-(-9.32 + 0.22*T + 0.08*RH)))  where T = mean temp °C, RH = mean humidity %
router.get('/dollar-spot', (req, res) => {
  const ACTION_THRESHOLD = 0.35;

  function smithKerns(tempAvg, humidity) {
    if (tempAvg == null || humidity == null) return null;
    const logit = -9.32 + 0.22 * tempAvg + 0.08 * humidity;
    return 1 / (1 + Math.exp(-logit));
  }

  try {
    const historyRows = db.prepare(
      'SELECT date, temp_avg, humidity FROM weather_history ORDER BY date ASC'
    ).all();

    const forecastRows = db.prepare(
      'SELECT date, temp_high, temp_low, humidity FROM weather_forecast ORDER BY date ASC'
    ).all();

    const history = historyRows.map(row => ({
      date: row.date,
      probability: smithKerns(row.temp_avg, row.humidity),
      type: 'history',
    }));

    const forecast = forecastRows.map(row => {
      const tempAvg = (row.temp_high != null && row.temp_low != null)
        ? (row.temp_high + row.temp_low) / 2
        : null;
      return {
        date: row.date,
        probability: smithKerns(tempAvg, row.humidity),
        type: 'forecast',
      };
    });

    res.json({ history, forecast, actionThreshold: ACTION_THRESHOLD });
  } catch (err) {
    console.error('Error calculating dollar spot:', err);
    res.status(500).json({ error: 'Failed to calculate dollar spot probability' });
  }
});

// GET /api/weather/growth-potential
// PACE Turf Growth Potential model (cool season grass)
// GP = exp(-0.5 * ((T_F - T_opt) / variance)^2)
// T_opt = 68°F, variance = 10 for cool season grass
router.get('/growth-potential', (req, res) => {
  const T_OPT_F = 68;
  const VARIANCE = 10;
  const OPTIMUM_THRESHOLD = 0.70;

  function growthPotential(tempAvgC) {
    if (tempAvgC == null) return null;
    const tempF = tempAvgC * 9 / 5 + 32;
    return Math.exp(-0.5 * Math.pow((tempF - T_OPT_F) / VARIANCE, 2));
  }

  try {
    const historyRows = db.prepare(
      'SELECT date, temp_avg FROM weather_history ORDER BY date ASC'
    ).all();

    const forecastRows = db.prepare(
      'SELECT date, temp_high, temp_low FROM weather_forecast ORDER BY date ASC'
    ).all();

    const history = historyRows.map(row => ({
      date: row.date,
      gp: growthPotential(row.temp_avg),
    }));

    const forecast = forecastRows.map(row => {
      const tempAvg = (row.temp_high != null && row.temp_low != null)
        ? (row.temp_high + row.temp_low) / 2
        : null;
      return {
        date: row.date,
        gp: growthPotential(tempAvg),
      };
    });

    res.json({ history, forecast, optimumThreshold: OPTIMUM_THRESHOLD });
  } catch (err) {
    console.error('Error calculating growth potential:', err);
    res.status(500).json({ error: 'Failed to calculate growth potential' });
  }
});

module.exports = router;
