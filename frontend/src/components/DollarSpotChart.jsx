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

function formatPct(value) {
  return value != null ? `${(value * 100).toFixed(2)}%` : '—'
}

export default function DollarSpotChart() {
  const [chartData, setChartData] = useState([])
  const [threshold, setThreshold] = useState(0.35)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/weather/dollar-spot')
      .then(r => r.json())
      .then(({ history, forecast, actionThreshold }) => {
        // Merge history and forecast into a single series, keyed by date
        const byDate = {}
        for (const row of history) {
          byDate[row.date] = { date: row.date, probability: row.probability }
        }
        for (const row of forecast) {
          // Don't overwrite historical data with forecast for the same date
          if (byDate[row.date]) {
            byDate[row.date].forecastProbability = row.probability
          } else {
            byDate[row.date] = { date: row.date, forecastProbability: row.probability }
          }
        }
        // Bridge: carry last historical value into forecast as starting point
        const sorted = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
        const lastHistIdx = sorted.reduce((last, row, i) => row.probability != null ? i : last, -1)
        if (lastHistIdx >= 0 && lastHistIdx + 1 < sorted.length) {
          sorted[lastHistIdx + 1].forecastProbability =
            sorted[lastHistIdx + 1].forecastProbability ?? sorted[lastHistIdx].probability
        }

        setChartData(sorted.slice(-40))
        setThreshold(actionThreshold)
      })
      .catch(err => console.error('Error fetching dollar spot data:', err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Loading dollar spot data...</div>

  return (
    <div className="card">
      <h2>Smith-Kerns Dollar Spot Probability Model</h2>
      {chartData.length === 0 ? (
        <div className="empty-state">No weather data yet. The collector runs daily to fetch data.</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                tick={{ fontSize: 12 }}
                domain={[0, 'auto']}
              />
              <Tooltip
                formatter={(value, name) => [formatPct(value), name]}
                labelFormatter={label => `Date: ${label}`}
              />
              <Legend />
              <ReferenceLine
                y={threshold}
                stroke="#f59e0b"
                strokeWidth={2}
                label={{ value: 'Action Threshold', position: 'right', fontSize: 11, fill: '#f59e0b' }}
                name="Action Threshold"
              />
              <Line
                type="monotone"
                dataKey="probability"
                name="Probability"
                stroke="#16a34a"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="forecastProbability"
                name="Forecast Probability"
                stroke="#16a34a"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="gdd-note">
            Based on mean daily temperature and relative humidity. Action threshold at {(threshold * 100).toFixed(0)}%.
          </p>
        </>
      )}
    </div>
  )
}
