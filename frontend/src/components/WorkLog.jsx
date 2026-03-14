import { useEffect, useState } from 'react'

const NUTRIENT_COLORS = { N: '#2d7a27', P: '#d97706', K: '#2563eb', Fe: '#9a3412', S: '#ca8a04' }

const R = 40
const ARC_LEN = Math.PI * R
const ARC_PATH = `M 10 50 A ${R} ${R} 0 0 1 90 50`

// Point on the arc at fraction t (0=left, 1=right)
function arcPoint(t) {
  const theta = Math.PI * (1 - t)
  return [50 + R * Math.cos(theta), 50 - R * Math.sin(theta)]
}

function ArcBase({ color, pct, children, viewH = 54 }) {
  const fill = (pct / 100) * ARC_LEN
  return (
    <svg viewBox={`0 0 100 ${viewH}`} style={{ width: '100%', display: 'block' }}>
      <path d={ARC_PATH} fill="none" stroke="#e5e7eb" strokeWidth="9" strokeLinecap="round" />
      <path d={ARC_PATH} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
        className="ng-arc-fill"
        strokeDasharray={ARC_LEN}
        strokeDashoffset={ARC_LEN - fill} />
      {children}
    </svg>
  )
}

function ArcLabel({ label, symbol, valText }) {
  return (
    <div style={{ textAlign: 'center', padding: '2px 8px 10px' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4b5563' }}>
        {label} ({symbol})
      </div>
      <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{valText}</div>
    </div>
  )
}

function NutrientGaugeCard({ label, symbol, total, target }) {
  const pct = Math.min((total / target) * 100, 100)
  const statusColor = pct < 40 ? '#ef4444' : pct < 72 ? '#f59e0b' : '#16a34a'
  const statusLabel = pct < 40 ? 'LOW' : pct < 72 ? 'ON TRACK' : 'GREAT'
  const [tipX, tipY] = arcPoint(pct / 100)
  const valText = `${total.toFixed(1)} / ${target} lbs`

  return (
    <div className="ng-card">
      <ArcBase color={statusColor} pct={pct} viewH={58}>
        {pct > 2 && (
          <>
            <circle cx={tipX} cy={tipY} r="7" fill={statusColor} opacity="0.2" />
            <circle cx={tipX} cy={tipY} r="4.5" fill={statusColor} />
            <circle cx={tipX} cy={tipY} r="2" fill="white" />
          </>
        )}
        <text x="50" y="43" textAnchor="middle" fill={statusColor}
          style={{ fontSize: '14px', fontWeight: '800', fontFamily: 'inherit' }}>
          {Math.round(pct)}%
        </text>
        <text x="50" y="54" textAnchor="middle" fill={statusColor}
          style={{ fontSize: '6.5px', fontWeight: '700', letterSpacing: '0.06em', fontFamily: 'inherit' }}>
          {statusLabel}
        </text>
      </ArcBase>
      <ArcLabel label={label} symbol={symbol} valText={valText} />
    </div>
  )
}

function todayString() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function WorkLog() {
  const [entries, setEntries] = useState([])
  const [form, setForm] = useState({
    date: todayString(),
    activity: '',
    notes: '',
    n_pct: '',
    p_pct: '',
    k_pct: '',
    fe_pct: '',
    s_pct: '',
    lbs_applied: '',
    spreader_setting: '',
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [lawnSqft, setLawnSqft] = useState(null)
  const [targets, setTargets] = useState({
    n_target: null,
    p_target: null,
    k_target: null,
    fe_target: null,
    s_target: null,
  })

  async function fetchEntries() {
    try {
      const res = await fetch('/api/worklog')
      const data = await res.json()
      setEntries(data)
    } catch (err) {
      console.error('Error fetching work log:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Fetch both settings and entries
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/worklog').then(r => r.json()),
    ])
      .then(([settings, worklog]) => {
        setLawnSqft(settings.lawn_sqft ? parseFloat(settings.lawn_sqft) : null)
        setTargets({
          n_target: settings.n_target ? parseFloat(settings.n_target) : null,
          p_target: settings.p_target ? parseFloat(settings.p_target) : null,
          k_target: settings.k_target ? parseFloat(settings.k_target) : null,
          fe_target: settings.fe_target ? parseFloat(settings.fe_target) : null,
          s_target: settings.s_target ? parseFloat(settings.s_target) : null,
        })
        setEntries(worklog)
      })
      .catch(err => console.error('Error fetching data:', err))
      .finally(() => setLoading(false))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.activity.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/worklog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setForm({
          date: todayString(),
          activity: '',
          notes: '',
          n_pct: '',
          p_pct: '',
          k_pct: '',
          fe_pct: '',
          s_pct: '',
          lbs_applied: '',
          spreader_setting: '',
        })
        // Re-fetch entries
        const updatedRes = await fetch('/api/worklog')
        const updatedData = await updatedRes.json()
        setEntries(updatedData)
      }
    } catch (err) {
      console.error('Error creating work log entry:', err)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    try {
      const res = await fetch(`/api/worklog/${id}`, { method: 'DELETE' })
      if (res.ok) {
        // Re-fetch entries
        const updatedRes = await fetch('/api/worklog')
        const updatedData = await updatedRes.json()
        setEntries(updatedData)
      }
    } catch (err) {
      console.error('Error deleting work log entry:', err)
    }
  }

  // Calculate yearly totals for current year
  function getYearlyTotals() {
    const currentYear = new Date().getFullYear()
    const yearlyEntries = entries.filter(e => e.date.startsWith(currentYear.toString()))
    
    let n_total = 0, p_total = 0, k_total = 0, fe_total = 0, s_total = 0
    
    yearlyEntries.forEach(entry => {
      const lbs = entry.lbs_applied ? parseFloat(entry.lbs_applied) : 0
      if (entry.n_pct && lbs) n_total += (parseFloat(entry.n_pct) / 100) * lbs
      if (entry.p_pct && lbs) p_total += (parseFloat(entry.p_pct) / 100) * lbs
      if (entry.k_pct && lbs) k_total += (parseFloat(entry.k_pct) / 100) * lbs
      if (entry.fe_pct && lbs) fe_total += (parseFloat(entry.fe_pct) / 100) * lbs
      if (entry.s_pct && lbs) s_total += (parseFloat(entry.s_pct) / 100) * lbs
    })
    
    return { n_total, p_total, k_total, fe_total, s_total }
  }

  return (
    <>
      {/* Yearly nutrient totals */}
      {!loading && (
        <div className="card">
          <h2>Yearly Nutrient Summary</h2>
          {(() => {
            const { n_total, p_total, k_total, fe_total, s_total } = getYearlyTotals()
            const hasTargets = targets.n_target || targets.p_target || targets.k_target || targets.fe_target || targets.s_target

            if (!hasTargets) {
              return <div className="empty-state">Set nutrient targets in settings and log work to see progress.</div>
            }

            const nutrients = [
              targets.n_target && { label: 'Nitrogen',   symbol: 'N',  total: n_total,  target: targets.n_target },
              targets.p_target && { label: 'Phosphorus', symbol: 'P',  total: p_total,  target: targets.p_target },
              targets.k_target && { label: 'Potassium',  symbol: 'K',  total: k_total,  target: targets.k_target },
              targets.fe_target && { label: 'Iron',      symbol: 'Fe', total: fe_total, target: targets.fe_target },
              targets.s_target && { label: 'Sulfur',     symbol: 'S',  total: s_total,  target: targets.s_target },
            ].filter(Boolean)

            return (
              <div className="nutrient-gauges">
                {nutrients.map(n => (
                  <NutrientGaugeCard key={n.symbol} {...n} />
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {/* Add new entry form */}
      <div className="card">
        <h2>Log Work</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="date">Date</label>
              <input
                id="date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="activity">Activity</label>
              <input
                id="activity"
                type="text"
                placeholder="e.g. Applied fertilizer"
                value={form.activity}
                onChange={(e) => setForm({ ...form, activity: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              placeholder="Optional notes..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className="form-section-header">Product Details</div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="n_pct">Nitrogen (N) %</label>
              <input
                id="n_pct"
                type="number"
                step="0.01"
                placeholder="e.g. 46"
                value={form.n_pct}
                onChange={(e) => setForm({ ...form, n_pct: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="p_pct">Phosphorus (P) %</label>
              <input
                id="p_pct"
                type="number"
                step="0.01"
                placeholder="e.g. 0"
                value={form.p_pct}
                onChange={(e) => setForm({ ...form, p_pct: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="k_pct">Potassium (K) %</label>
              <input
                id="k_pct"
                type="number"
                step="0.01"
                placeholder="e.g. 0"
                value={form.k_pct}
                onChange={(e) => setForm({ ...form, k_pct: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="fe_pct">Iron (Fe) %</label>
              <input
                id="fe_pct"
                type="number"
                step="0.01"
                placeholder="e.g. 0"
                value={form.fe_pct}
                onChange={(e) => setForm({ ...form, fe_pct: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="s_pct">Sulfur (S) %</label>
              <input
                id="s_pct"
                type="number"
                step="0.01"
                placeholder="e.g. 0"
                value={form.s_pct}
                onChange={(e) => setForm({ ...form, s_pct: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="lbs_applied">Pounds Applied</label>
              <input
                id="lbs_applied"
                type="number"
                step="0.1"
                placeholder="e.g. 10.5"
                value={form.lbs_applied}
                onChange={(e) => setForm({ ...form, lbs_applied: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="spreader_setting">Spreader Setting</label>
              <input
                id="spreader_setting"
                type="text"
                placeholder="e.g. 18"
                value={form.spreader_setting}
                onChange={(e) => setForm({ ...form, spreader_setting: e.target.value })}
              />
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={submitting}>
            {submitting ? 'Saving...' : 'Log Work'}
          </button>
        </form>
      </div>

      {/* Work log entries */}
      <div className="card">
        <h2>Work History</h2>
        {loading ? (
          <div className="loading">Loading work log...</div>
        ) : entries.length === 0 ? (
          <div className="empty-state">No work logged yet.</div>
        ) : (
          <div className="worklog-entries">
            {entries.map((entry) => {
              const lbs = entry.lbs_applied ? parseFloat(entry.lbs_applied) : null
              const perThousandSqft = lbs && lawnSqft ? (lbs / (lawnSqft / 1000)) : null
              const n_total = entry.n_pct && lbs ? (entry.n_pct / 100) * lbs : null
              const p_total = entry.p_pct && lbs ? (entry.p_pct / 100) * lbs : null
              const k_total = entry.k_pct && lbs ? (entry.k_pct / 100) * lbs : null
              const fe_total = entry.fe_pct && lbs ? (entry.fe_pct / 100) * lbs : null
              const s_total = entry.s_pct && lbs ? (entry.s_pct / 100) * lbs : null

              const n_per_k = n_total && perThousandSqft ? n_total / (lawnSqft / 1000) : null
              const p_per_k = p_total && perThousandSqft ? p_total / (lawnSqft / 1000) : null
              const k_per_k = k_total && perThousandSqft ? k_total / (lawnSqft / 1000) : null
              const fe_per_k = fe_total && perThousandSqft ? fe_total / (lawnSqft / 1000) : null
              const s_per_k = s_total && perThousandSqft ? s_total / (lawnSqft / 1000) : null

              return (
                <div key={entry.id} className="worklog-entry">
                  <div className="entry-header">
                    <div className="entry-title">
                      <span className="entry-date">{entry.date}</span>
                      <span className="entry-activity">{entry.activity}</span>
                    </div>
                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(entry.id)}
                      title="Delete entry"
                    >
                      Delete
                    </button>
                  </div>

                  {entry.notes && <div className="entry-notes"><strong>Notes:</strong> {entry.notes}</div>}

                  {entry.spreader_setting && (
                    <div className="entry-field">
                      <strong>Spreader Setting:</strong> {entry.spreader_setting}
                    </div>
                  )}

                  {entry.lbs_applied && (
                    <div className="entry-field">
                      <strong>Pounds Applied:</strong> {parseFloat(entry.lbs_applied).toFixed(2)} lbs
                      {perThousandSqft && lawnSqft && (
                        <span className="secondary"> ({perThousandSqft.toFixed(2)} lbs per 1000 sqft)</span>
                      )}
                    </div>
                  )}

                  {(n_total || p_total || k_total || fe_total || s_total) && (
                    <div className="entry-nutrients">
                      <div className="nutrient-row">
                        {n_total !== null && (
                          <div className="nutrient">
                            <span className="nutrient-label">N (Total):</span>
                            <span className="nutrient-value">{n_total.toFixed(2)} lbs</span>
                            {n_per_k !== null && <span className="nutrient-per-k">{n_per_k.toFixed(2)} lbs/1K sqft</span>}
                          </div>
                        )}
                        {p_total !== null && (
                          <div className="nutrient">
                            <span className="nutrient-label">P (Total):</span>
                            <span className="nutrient-value">{p_total.toFixed(2)} lbs</span>
                            {p_per_k !== null && <span className="nutrient-per-k">{p_per_k.toFixed(2)} lbs/1K sqft</span>}
                          </div>
                        )}
                        {k_total !== null && (
                          <div className="nutrient">
                            <span className="nutrient-label">K (Total):</span>
                            <span className="nutrient-value">{k_total.toFixed(2)} lbs</span>
                            {k_per_k !== null && <span className="nutrient-per-k">{k_per_k.toFixed(2)} lbs/1K sqft</span>}
                          </div>
                        )}
                      </div>
                      <div className="nutrient-row">
                        {fe_total !== null && (
                          <div className="nutrient">
                            <span className="nutrient-label">Fe (Total):</span>
                            <span className="nutrient-value">{fe_total.toFixed(2)} lbs</span>
                            {fe_per_k !== null && <span className="nutrient-per-k">{fe_per_k.toFixed(2)} lbs/1K sqft</span>}
                          </div>
                        )}
                        {s_total !== null && (
                          <div className="nutrient">
                            <span className="nutrient-label">S (Total):</span>
                            <span className="nutrient-value">{s_total.toFixed(2)} lbs</span>
                            {s_per_k !== null && <span className="nutrient-per-k">{s_per_k.toFixed(2)} lbs/1K sqft</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
