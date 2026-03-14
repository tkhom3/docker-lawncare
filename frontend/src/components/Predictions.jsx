import { useEffect, useState } from 'react'
import {
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

function formatDate(dateStr) {
  const [, month, day] = dateStr.split('-')
  return `${parseInt(month)}/${parseInt(day)}`
}

function formatFull(dateStr) {
  if (!dateStr) return '—'
  const [year, month, day] = dateStr.split('-')
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const THRESHOLD_META = [
  { gdd: 200, label: 'Pre-emergent',        color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  { gdd: 300, label: 'Crabgrass germinating', color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  { gdd: 500, label: 'Spring fertilization', color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
]

export default function Predictions() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/weather/predictions')
      .then(r => r.json())
      .then(setData)
      .catch(err => console.error('Error fetching predictions:', err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Loading predictions...</div>
  if (!data || !data.history || (!data.history.length && !data.forecast.length)) {
    return <div className="empty-state">No weather data yet. The collector will populate data on its next run.</div>
  }

  // Merge all series into one chart array
  const histDates = new Set(data.history.map(p => p.date))
  const foreDates = new Set(data.forecast.map(p => p.date))
  const chartData = [
    ...data.history.map(p => ({ date: p.date, history: p.cumulative_gdd })),
    ...data.forecast
      .filter(p => !histDates.has(p.date))
      .map(p => ({ date: p.date, forecast: p.cumulative_gdd })),
    ...data.estimated
      .filter(p => !histDates.has(p.date) && !foreDates.has(p.date))
      .map(p => ({ date: p.date, estimated: p.cumulative_gdd })),
  ]
  // Bridge gaps between series
  const lastHistIdx = chartData.reduce((last, p, i) => p.history != null ? i : last, -1)
  if (lastHistIdx >= 0 && lastHistIdx + 1 < chartData.length && chartData[lastHistIdx + 1].forecast != null) {
    chartData[lastHistIdx + 1].history = chartData[lastHistIdx].history
  }
  const lastForeIdx = chartData.reduce((last, p, i) => p.forecast != null ? i : last, -1)
  if (lastForeIdx >= 0 && lastForeIdx + 1 < chartData.length && chartData[lastForeIdx + 1].estimated != null) {
    chartData[lastForeIdx + 1].forecast = chartData[lastForeIdx].forecast
  }

  const maxGdd = Math.max(...THRESHOLD_META.map(t => t.gdd)) + 50

  return (
    <>
      {/* Summary cards */}
      <div className="prediction-cards">
        {data.crossings.map((crossing) => {
          const meta = THRESHOLD_META.find(t => t.gdd === crossing.gdd)
          const reached = crossing.daysUntil !== null && crossing.daysUntil <= 0
          const isForecast = crossing.series === 'forecast'
          const isEstimated = crossing.series === 'estimated'
          return (
            <div key={crossing.gdd} className="prediction-card" style={{ borderColor: meta.border, background: meta.bg }}>
              <div className="prediction-card-label" style={{ color: meta.color }}>{crossing.label}</div>
              <div className="prediction-card-gdd">{crossing.gdd} GDD</div>
              {reached ? (
                <div className="prediction-card-date reached">Threshold reached</div>
              ) : crossing.date ? (
                <>
                  <div className="prediction-card-date" style={{ color: meta.color }}>
                    {formatFull(crossing.date)}
                  </div>
                  <div className="prediction-card-days">
                    {crossing.daysUntil === 1 ? 'Tomorrow' : `${crossing.daysUntil} days away`}
                    <span className="prediction-series">
                      {isForecast ? ' · forecast' : isEstimated ? ' · estimated' : ''}
                    </span>
                  </div>
                </>
              ) : (
                <div className="prediction-card-date">Beyond projection window</div>
              )}
            </div>
          )
        })}
      </div>

      {/* GDD chart */}
      <div className="card">
        <h2>Cumulative GDD Projection (Base 50°F)</h2>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 12 }} domain={[0, maxGdd]} />
            <Tooltip
              formatter={(value, name) => [value != null ? value.toFixed(1) : '—', name]}
              labelFormatter={label => `Date: ${label}`}
            />
            <Legend />
            {THRESHOLD_META.map(t => (
              <ReferenceLine
                key={t.gdd}
                y={t.gdd}
                stroke={t.color}
                strokeDasharray="4 3"
                label={{ value: t.label, position: 'insideTopLeft', fontSize: 11, fill: t.color }}
              />
            ))}
            <Line type="monotone" dataKey="history"   name="Historical GDD" stroke="#2d5a27" strokeWidth={2} dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="forecast"  name="Forecast GDD"   stroke="#2d5a27" strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="estimated" name="Estimated GDD"  stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="3 3" dot={false} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="gdd-note">
          Forecast projection uses 8-day forecast data. Estimated projection uses the 14-day average daily GDD ({data.avgDailyGdd} GDD/day).
        </p>
      </div>
    </>
  )
}
