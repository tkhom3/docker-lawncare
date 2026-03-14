import { useEffect, useState } from 'react'

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
            const hasData = n_total || p_total || k_total || fe_total || s_total

            if (!hasData && !hasTargets) {
              return <div className="empty-state">Set nutrient targets in settings and log work to see progress.</div>
            }

            return (
              <div className="nutrient-gauges">
                {targets.n_target && (
                  <div className="nutrient-gauge">
                    <div className="gauge-label">Nitrogen (N)</div>
                    <div className="gauge-container">
                      <div className="gauge-bar">
                        <div
                          className="gauge-fill"
                          style={{ width: `${Math.min((n_total / targets.n_target) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <div className="gauge-value">{n_total.toFixed(1)} / {targets.n_target} lbs</div>
                      <div className="gauge-percent">{((n_total / targets.n_target) * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                )}
                {targets.p_target && (
                  <div className="nutrient-gauge">
                    <div className="gauge-label">Phosphorus (P)</div>
                    <div className="gauge-container">
                      <div className="gauge-bar">
                        <div
                          className="gauge-fill"
                          style={{ width: `${Math.min((p_total / targets.p_target) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <div className="gauge-value">{p_total.toFixed(1)} / {targets.p_target} lbs</div>
                      <div className="gauge-percent">{((p_total / targets.p_target) * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                )}
                {targets.k_target && (
                  <div className="nutrient-gauge">
                    <div className="gauge-label">Potassium (K)</div>
                    <div className="gauge-container">
                      <div className="gauge-bar">
                        <div
                          className="gauge-fill"
                          style={{ width: `${Math.min((k_total / targets.k_target) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <div className="gauge-value">{k_total.toFixed(1)} / {targets.k_target} lbs</div>
                      <div className="gauge-percent">{((k_total / targets.k_target) * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                )}
                {targets.fe_target && (
                  <div className="nutrient-gauge">
                    <div className="gauge-label">Iron (Fe)</div>
                    <div className="gauge-container">
                      <div className="gauge-bar">
                        <div
                          className="gauge-fill"
                          style={{ width: `${Math.min((fe_total / targets.fe_target) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <div className="gauge-value">{fe_total.toFixed(1)} / {targets.fe_target} lbs</div>
                      <div className="gauge-percent">{((fe_total / targets.fe_target) * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                )}
                {targets.s_target && (
                  <div className="nutrient-gauge">
                    <div className="gauge-label">Sulfur (S)</div>
                    <div className="gauge-container">
                      <div className="gauge-bar">
                        <div
                          className="gauge-fill"
                          style={{ width: `${Math.min((s_total / targets.s_target) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <div className="gauge-value">{s_total.toFixed(1)} / {targets.s_target} lbs</div>
                      <div className="gauge-percent">{((s_total / targets.s_target) * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                )}
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
