import { useEffect, useState } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

function formatDate(dateStr) {
  const [, month, day] = dateStr.split('-')
  return `${parseInt(month)}/${parseInt(day)}`
}

function formatFull(dateStr) {
  const [year, month, day] = dateStr.split('-')
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function cToF(c) {
  return c != null ? Math.round((c * 9 / 5 + 32) * 10) / 10 : null
}

function mmToIn(mm) {
  return mm != null ? Math.round((mm / 25.4) * 100) / 100 : null
}

// ── View A: Table ────────────────────────────────────────────────────────────
function TableView({ rows }) {
  return (
    <table className="forecast-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>High °F</th>
          <th>Low °F</th>
          <th>Humidity %</th>
          <th>Precip in</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.date} style={row.type === 'forecast' ? { color: '#6b7280', fontStyle: 'italic' } : {}}>
            <td>{row.date}</td>
            <td>{row.temp_high != null ? row.temp_high.toFixed(1) : '—'}</td>
            <td>{row.temp_low != null ? row.temp_low.toFixed(1) : '—'}</td>
            <td>{row.humidity != null ? row.humidity.toFixed(0) : '—'}</td>
            <td>{row.precip != null ? row.precip.toFixed(2) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── View B: Day cards ────────────────────────────────────────────────────────
function CardsView({ rows }) {
  return (
    <div className="day-cards">
      {rows.map(row => (
        <div key={row.date} className={`day-card ${row.type === 'forecast' ? 'day-card--forecast' : ''}`}>
          <div className="day-card-date">{formatFull(row.date)}</div>
          <div className="day-card-temps">
            <span className="day-card-high">{row.temp_high != null ? `${row.temp_high.toFixed(0)}°` : '—'}</span>
            <span className="day-card-sep">/</span>
            <span className="day-card-low">{row.temp_low != null ? `${row.temp_low.toFixed(0)}°` : '—'}</span>
          </div>
          <div className="day-card-detail">
            <span title="Humidity">💧 {row.humidity != null ? `${row.humidity.toFixed(0)}%` : '—'}</span>
            <span title="Precipitation">🌧 {row.precip != null ? `${row.precip.toFixed(2)}"` : '—'}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── View C: Chart ────────────────────────────────────────────────────────────
function ChartView({ rows }) {
  const today = new Date().toISOString().split('T')[0]
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={rows} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
        <YAxis yAxisId="temp" unit="°F" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="precip" orientation="right" hide />
        <Tooltip
          formatter={(value, name) => {
            if (name === 'Precip') return [`${value?.toFixed(2)}"`, name]
            return [`${value}°F`, name]
          }}
          labelFormatter={label => formatFull(label)}
        />
        <Legend />
        {today && <ReferenceLine yAxisId="temp" x={today} stroke="#9ca3af" strokeDasharray="4 3" label={{ value: 'Today', position: 'insideTopRight', fontSize: 10, fill: '#9ca3af' }} />}
        <Bar yAxisId="precip" dataKey="precip" name="Precip" fill="#93c5fd" opacity={0.7} />
        <Line yAxisId="temp" type="monotone" dataKey="temp_high" name="High" stroke="#ef4444" dot={false} strokeWidth={2} />
        <Line yAxisId="temp" type="monotone" dataKey="temp_low" name="Low" stroke="#3b82f6" dot={false} strokeWidth={2} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function WeatherChart() {
  const [history, setHistory] = useState([])
  const [combinedRows, setCombinedRows] = useState([])
  const [view, setView] = useState('chart')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      try {
        const [histRes, foreRes] = await Promise.all([
          fetch('/api/weather/history'),
          fetch('/api/weather/forecast'),
        ])
        const histData = await histRes.json()
        const foreData = await foreRes.json()

        const sorted = [...histData]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map(r => ({
            ...r,
            temp_avg: cToF(r.temp_avg),
            temp_high: cToF(r.temp_high),
            temp_low: cToF(r.temp_low),
            soil_temp_est: cToF(r.soil_temp_est),
            precip: mmToIn(r.precip),
          }))
        setHistory(sorted.slice(-30))

        const last7 = sorted.slice(-7).map(r => ({ ...r, type: 'history' }))
        const fore = foreData.map(r => ({
          ...r,
          temp_high: cToF(r.temp_high),
          temp_low: cToF(r.temp_low),
          precip: mmToIn(r.precip),
          type: 'forecast',
        }))
        setCombinedRows([...last7, ...fore.slice(0, 7)])
      } catch (err) {
        console.error('Error fetching weather data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  if (loading) return <div className="loading">Loading weather data...</div>

  return (
    <>
      {/* Temperature History */}
      <div className="card">
        <h2>Temperature History</h2>
        {history.length === 0 ? (
          <div className="empty-state">No weather data yet. The collector runs daily to fetch data.</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={history} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} />
              <YAxis unit="°F" tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, name) => [`${value}°F`, name]}
                labelFormatter={label => `Date: ${label}`}
              />
              <Legend />
              <Bar dataKey="temp_avg" name="Avg Temp" fill="#4ade80" />
              <Line type="monotone" dataKey="temp_high" name="High Temp" stroke="#ef4444" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="temp_low" name="Low Temp" stroke="#3b82f6" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="soil_temp_est" name="Est. Soil Temp (14d avg)" stroke="#a16207" dot={false} strokeWidth={2} strokeDasharray="5 3" connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent & Forecast */}
      <div className="card">
        <div className="card-header-row">
          <h2>Recent &amp; Forecast</h2>
          <div className="view-toggle">
            {[['cards', 'Cards'], ['chart', 'Chart'], ['table', 'Table']].map(([key, label]) => (
              <button
                key={key}
                className={`view-toggle-btn ${view === key ? 'active' : ''}`}
                onClick={() => setView(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {combinedRows.length === 0 ? (
          <div className="empty-state">No weather data yet. The collector runs daily to fetch data.</div>
        ) : (
          <>
            {view === 'table' && <TableView rows={combinedRows} />}
            {view === 'cards' && <CardsView rows={combinedRows} />}
            {view === 'chart' && <ChartView rows={combinedRows} />}
          </>
        )}
      </div>
    </>
  )
}
