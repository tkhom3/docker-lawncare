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

export default function GrowthPotentialChart() {
  const [chartData, setChartData] = useState([])
  const [threshold, setThreshold] = useState(0.70)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/weather/growth-potential')
      .then(r => r.json())
      .then(({ history, forecast, optimumThreshold }) => {
        const byDate = {}
        for (const row of history) {
          byDate[row.date] = { date: row.date, coolGP: row.gp }
        }
        for (const row of forecast) {
          if (byDate[row.date]) {
            byDate[row.date].forecastGP = row.gp
          } else {
            byDate[row.date] = { date: row.date, forecastGP: row.gp }
          }
        }
        // Bridge last historical point into forecast
        const sorted = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
        const lastHistIdx = sorted.reduce((last, row, i) => row.coolGP != null ? i : last, -1)
        if (lastHistIdx >= 0 && lastHistIdx + 1 < sorted.length) {
          sorted[lastHistIdx + 1].forecastGP =
            sorted[lastHistIdx + 1].forecastGP ?? sorted[lastHistIdx].coolGP
        }

        setChartData(sorted.slice(-40))
        setThreshold(optimumThreshold)
      })
      .catch(err => console.error('Error fetching growth potential:', err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Loading growth potential data...</div>

  return (
    <div className="card">
      <h2>Growth Potential</h2>
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
                domain={[0, 1]}
              />
              <Tooltip
                formatter={(value, name) => [formatPct(value), name]}
                labelFormatter={label => `Date: ${label}`}
              />
              <Legend />
              <ReferenceLine
                y={threshold}
                stroke="#4d7c0f"
                strokeWidth={2}
                strokeDasharray="5 4"
                label={{ value: 'Optimum GP', position: 'right', fontSize: 11, fill: '#4d7c0f' }}
              />
              <Line
                type="monotone"
                dataKey="coolGP"
                name="GP"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="forecastGP"
                name="Forecast GP"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="8 4"
                dot={false}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="gdd-note">
            PACE Turf model — cool season grass: optimum 68°F, variance 10°F.
            GP above {(threshold * 100).toFixed(0)}% indicates strong growth conditions.
          </p>
        </>
      )}
    </div>
  )
}
