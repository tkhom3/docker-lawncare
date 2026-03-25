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

function ArcBase({ color, pct, plannedPct, children, viewH = 54 }) {
  const fill = (pct / 100) * ARC_LEN
  const plannedFill = plannedPct != null ? (Math.min(plannedPct, 100) / 100) * ARC_LEN : null
  return (
    <svg viewBox={`0 0 100 ${viewH}`} style={{ width: '100%', display: 'block' }}>
      <path d={ARC_PATH} fill="none" stroke="#e5e7eb" strokeWidth="9" strokeLinecap="round" />
      {plannedFill != null && plannedFill > fill && (
        <path d={ARC_PATH} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          opacity="0.28"
          strokeDasharray={ARC_LEN}
          strokeDashoffset={ARC_LEN - plannedFill} />
      )}
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

function NutrientGaugeCard({ label, symbol, total, target, adjusted, plannedTotal }) {
  const rawPct    = (total / target) * 100
  const rawCombo  = plannedTotal != null ? ((total + plannedTotal) / target) * 100 : null

  const appliedOver = rawPct > 100
  const comboOver   = rawCombo != null && rawCombo > 100

  // Arc drawing — cap at 100 so we don't draw past the arc end
  const arcPct     = Math.min(rawPct, 100)
  const arcPlanned = rawCombo != null ? Math.min(rawCombo, 100) : null

  const statusColor = appliedOver ? '#7c3aed'
    : rawPct < 40 ? '#ef4444'
    : rawPct < 72 ? '#f59e0b'
    : '#16a34a'
  const statusLabel = appliedOver ? 'OVER'
    : rawPct < 40 ? 'LOW'
    : rawPct < 72 ? 'ON TRACK'
    : 'GREAT'

  // Planned arc color — purple when combo will exceed target
  const plannedColor = comboOver ? '#7c3aed' : statusColor

  const [tipX, tipY] = arcPoint(arcPct / 100)

  const excessApplied = appliedOver ? (total - target).toFixed(1) : null
  const excessCombo   = comboOver && !appliedOver ? (total + plannedTotal - target).toFixed(1) : null

  const valText = appliedOver
    ? `${total.toFixed(1)} lbs (+${excessApplied} over)`
    : plannedTotal != null && plannedTotal > 0
      ? comboOver
        ? `${total.toFixed(1)} + ${plannedTotal.toFixed(1)} planned (+${excessCombo} over)`
        : `${total.toFixed(1)} + ${plannedTotal.toFixed(1)} planned / ${target.toFixed(1)} lbs`
      : `${total.toFixed(1)} / ${target.toFixed(1)} lbs`

  return (
    <div className="ng-card">
      <svg viewBox="0 0 100 58" style={{ width: '100%', display: 'block' }}>
        {/* Background arc */}
        <path d={ARC_PATH} fill="none" stroke="#e5e7eb" strokeWidth="9" strokeLinecap="round" />

        {/* Planned arc (faded) — shown when there's pending planned work */}
        {arcPlanned != null && arcPlanned > arcPct && (
          <path d={ARC_PATH} fill="none" stroke={plannedColor} strokeWidth="9" strokeLinecap="round"
            opacity="0.28"
            strokeDasharray={ARC_LEN}
            strokeDashoffset={ARC_LEN - (arcPlanned / 100) * ARC_LEN} />
        )}

        {/* Applied arc */}
        <path d={ARC_PATH} fill="none" stroke={statusColor} strokeWidth="9" strokeLinecap="round"
          className="ng-arc-fill"
          strokeDasharray={ARC_LEN}
          strokeDashoffset={ARC_LEN - (arcPct / 100) * ARC_LEN} />

        {/* Overflow pulse ring at right end when over */}
        {appliedOver && (
          <>
            <circle cx="90" cy="50" r="8" fill={statusColor} opacity="0.15" />
            <circle cx="90" cy="50" r="5" fill={statusColor} opacity="0.4" />
          </>
        )}
        {comboOver && !appliedOver && (
          <circle cx="90" cy="50" r="6" fill={plannedColor} opacity="0.3" />
        )}

        {/* Applied tip marker */}
        {arcPct > 2 && !appliedOver && (
          <>
            <circle cx={tipX} cy={tipY} r="7" fill={statusColor} opacity="0.2" />
            <circle cx={tipX} cy={tipY} r="4.5" fill={statusColor} />
            <circle cx={tipX} cy={tipY} r="2" fill="white" />
          </>
        )}

        <text x="50" y="43" textAnchor="middle" fill={statusColor}
          style={{ fontSize: '14px', fontWeight: '800', fontFamily: 'inherit' }}>
          {Math.round(rawPct)}%
        </text>
        <text x="50" y="54" textAnchor="middle" fill={statusColor}
          style={{ fontSize: '6.5px', fontWeight: '700', letterSpacing: '0.06em', fontFamily: 'inherit' }}>
          {statusLabel}
        </text>
      </svg>
      <ArcLabel label={label} symbol={symbol} valText={valText} />
      {adjusted && (
        <div style={{ fontSize: '0.65rem', color: '#6b7280', textAlign: 'center', paddingBottom: '6px' }}>
          soil-adjusted
        </div>
      )}
    </div>
  )
}

// Apply soil test adjustments to base targets (lbs for the whole lawn)
// Uses ISU Midwest thresholds
function applySoilAdjustments(targets, lawnSqft, soilTest) {
  const result = { ...targets, adjusted: {} }
  if (!soilTest || !lawnSqft) return result

  const thousand = lawnSqft / 1000

  if (soilTest.p_ppm !== null && soilTest.p_ppm !== undefined && targets.p_target !== null) {
    const ppm = soilTest.p_ppm
    const multiplier = ppm < 15 ? 1.0 : ppm < 30 ? 0.75 : ppm < 50 ? 0.5 : 0.0
    if (multiplier !== 1.0) {
      result.p_target = targets.p_target * multiplier
      result.adjusted.p = true
    }
  }

  if (soilTest.k_ppm !== null && soilTest.k_ppm !== undefined && targets.k_target !== null) {
    const ppm = soilTest.k_ppm
    const multiplier = ppm < 100 ? 1.0 : ppm < 150 ? 0.75 : ppm < 200 ? 0.5 : 0.0
    if (multiplier !== 1.0) {
      result.k_target = targets.k_target * multiplier
      result.adjusted.k = true
    }
  }

  if (soilTest.om_pct !== null && soilTest.om_pct !== undefined && targets.n_target !== null) {
    const om = soilTest.om_pct
    const multiplier = om > 5 ? 0.8 : om > 3 ? 0.9 : 1.0
    if (multiplier !== 1.0) {
      result.n_target = targets.n_target * multiplier
      result.adjusted.n = true
    }
  }

  // Iron: DTPA Fe thresholds — < 4.5 ppm low (full), 4.5–10 ppm adequate (50%), ≥ 10 ppm high (skip)
  if (soilTest.fe_ppm !== null && soilTest.fe_ppm !== undefined && targets.fe_target !== null) {
    const ppm = soilTest.fe_ppm
    const multiplier = ppm < 4.5 ? 1.0 : ppm < 10 ? 0.5 : 0.0
    if (multiplier !== 1.0) {
      result.fe_target = targets.fe_target * multiplier
      result.adjusted.fe = true
    }
  }

  // Sulfur: pH thresholds — < 5.5 skip (too acidic), 5.5–6.5 half rate, ≥ 6.5 full rate
  if (soilTest.ph !== null && soilTest.ph !== undefined && targets.s_target !== null) {
    const ph = soilTest.ph
    const multiplier = ph < 5.5 ? 0.0 : ph < 6.5 ? 0.5 : 1.0
    if (multiplier !== 1.0) {
      result.s_target = targets.s_target * multiplier
      result.adjusted.s = true
    }
  }

  return result
}

function soilTestLabel(fieldLabel, value, unit) {
  if (value === null || value === undefined) return null
  return `${fieldLabel}: ${value}${unit}`
}

function todayString() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const EMPTY_SOIL_FORM = {
  date: todayString(),
  notes: '',
  ph: '',
  om_pct: '',
  p_ppm: '',
  k_ppm: '',
  fe_ppm: '',
}

const EMPTY_PLAN_FORM = {
  planned_date: todayString(),
  activity: '',
  notes: '',
  n_pct: '',
  p_pct: '',
  k_pct: '',
  fe_pct: '',
  s_pct: '',
  lbs_planned: '',
  spreader_setting: '',
}

// ── Shared helpers ──────────────────────────────────────────────────────────

function nutrientLbs(entry, lbsField) {
  const lbs = entry[lbsField] ? parseFloat(entry[lbsField]) : 0
  return {
    n: entry.n_pct && lbs ? (entry.n_pct / 100) * lbs : null,
    p: entry.p_pct && lbs ? (entry.p_pct / 100) * lbs : null,
    k: entry.k_pct && lbs ? (entry.k_pct / 100) * lbs : null,
    fe: entry.fe_pct && lbs ? (entry.fe_pct / 100) * lbs : null,
    s: entry.s_pct && lbs ? (entry.s_pct / 100) * lbs : null,
  }
}

function NutrientCell({ totalLbs, lawnSqft }) {
  if (totalLbs == null) return <span style={{ color: '#d1d5db' }}>—</span>
  const per1k = lawnSqft ? totalLbs / (lawnSqft / 1000) : null
  const display = per1k != null ? per1k.toFixed(2) : totalLbs.toFixed(2)
  const tooltip = per1k != null ? `${totalLbs.toFixed(2)} lbs total` : null
  return <span title={tooltip} style={{ cursor: tooltip ? 'help' : undefined }}>{display}</span>
}

function NutrientDots({ n, p, k, fe, s }) {
  const items = [['N', n, '#2d7a27'], ['P', p, '#d97706'], ['K', k, '#2563eb'], ['Fe', fe, '#9a3412'], ['S', s, '#ca8a04']]
  const active = items.filter(([, v]) => v != null)
  if (!active.length) return null
  return (
    <span style={{ display: 'inline-flex', gap: '5px', flexWrap: 'wrap' }}>
      {active.map(([label, val, color]) => (
        <span key={label} style={{
          fontSize: '0.7rem', fontWeight: 700, color: 'white',
          background: color, borderRadius: '4px', padding: '1px 6px',
        }}>{label} {val.toFixed(2)}</span>
      ))}
    </span>
  )
}

// ── Work History Table ───────────────────────────────────────────────────────

function HistoryTable({ entries, lawnSqft, onDelete }) {
  const nutHeader = lawnSqft ? 'lbs/1k' : 'lbs'
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="wl-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Product</th>
            <th>lbs</th>
            <th title={`N (${nutHeader})`}>N</th>
            <th title={`P (${nutHeader})`}>P</th>
            <th title={`K (${nutHeader})`}>K</th>
            <th title={`Fe (${nutHeader})`}>Fe</th>
            <th title={`S (${nutHeader})`}>S</th>
            <th>Spreader</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => {
            const lbs = entry.lbs_applied ? parseFloat(entry.lbs_applied) : null
            const nuts = nutrientLbs(entry, 'lbs_applied')
            return (
              <tr key={entry.id}>
                <td className="wl-td-date">{entry.date}</td>
                <td>
                  <div style={{ fontWeight: 600, color: '#2d5a27' }}>{entry.activity}</div>
                  {entry.notes && <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '2px' }}>{entry.notes}</div>}
                </td>
                <td className="wl-td-num">{lbs ? lbs.toFixed(1) : '—'}</td>
                {['n','p','k','fe','s'].map(key => (
                  <td key={key} className="wl-td-num">
                    <NutrientCell totalLbs={nuts[key]} lawnSqft={lawnSqft} />
                  </td>
                ))}
                <td style={{ fontSize: '0.82rem', color: '#6b7280' }}>{entry.spreader_setting || '—'}</td>
                <td><button className="delete-btn" onClick={() => onDelete(entry.id)}>Delete</button></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Planned Work Table ───────────────────────────────────────────────────────

function PlanTable({ entries, lawnSqft, editingId, editForm, setEditForm, submitting, onToggle, onCancelEdit, onEditSubmit, onEdit, onDelete }) {
  const COL_COUNT = 11
  const nutHeader = lawnSqft ? 'lbs/1k' : 'lbs'
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="wl-table">
        <thead>
          <tr>
            <th style={{ width: '32px' }}></th>
            <th>Date</th>
            <th>Product</th>
            <th>lbs</th>
            <th title={`N (${nutHeader})`}>N</th>
            <th title={`P (${nutHeader})`}>P</th>
            <th title={`K (${nutHeader})`}>K</th>
            <th title={`Fe (${nutHeader})`}>Fe</th>
            <th title={`S (${nutHeader})`}>S</th>
            <th>Spreader</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => {
            if (editingId === entry.id) {
              return (
                <tr key={entry.id} style={{ background: '#f0f9ff' }}>
                  <td colSpan={COL_COUNT} style={{ padding: '14px 12px' }}>
                    <form onSubmit={(e) => onEditSubmit(e, entry.id)}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>Date</label>
                          <input type="date" value={editForm.planned_date} onChange={e => setEditForm({ ...editForm, planned_date: e.target.value })} required />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
                          <label>Product</label>
                          <input type="text" value={editForm.activity} onChange={e => setEditForm({ ...editForm, activity: e.target.value })} required />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>N %</label>
                          <input type="number" step="0.01" value={editForm.n_pct} onChange={e => setEditForm({ ...editForm, n_pct: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>P %</label>
                          <input type="number" step="0.01" value={editForm.p_pct} onChange={e => setEditForm({ ...editForm, p_pct: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>K %</label>
                          <input type="number" step="0.01" value={editForm.k_pct} onChange={e => setEditForm({ ...editForm, k_pct: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>Fe %</label>
                          <input type="number" step="0.01" value={editForm.fe_pct} onChange={e => setEditForm({ ...editForm, fe_pct: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>S %</label>
                          <input type="number" step="0.01" value={editForm.s_pct} onChange={e => setEditForm({ ...editForm, s_pct: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>lbs Planned</label>
                          <input type="number" step="0.1" value={editForm.lbs_planned} onChange={e => setEditForm({ ...editForm, lbs_planned: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>Spreader</label>
                          <input type="text" value={editForm.spreader_setting} onChange={e => setEditForm({ ...editForm, spreader_setting: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
                          <label>Notes</label>
                          <input type="text" value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="submit" className="submit-btn" disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button>
                        <button type="button" className="submit-btn secondary" onClick={onCancelEdit}>Cancel</button>
                      </div>
                    </form>
                  </td>
                </tr>
              )
            }

            const lbs = entry.lbs_planned ? parseFloat(entry.lbs_planned) : null
            const nuts = nutrientLbs(entry, 'lbs_planned')
            return (
              <tr key={entry.id}>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={!!entry.completed} onChange={() => onToggle(entry.id)}
                    style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#16a34a' }} />
                </td>
                <td className="wl-td-date">{entry.planned_date}</td>
                <td>
                  <div style={{ fontWeight: 600, color: '#2d5a27' }}>{entry.activity}</div>
                  {entry.notes && <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '2px' }}>{entry.notes}</div>}
                </td>
                <td className="wl-td-num">{lbs ? lbs.toFixed(1) : '—'}</td>
                {['n','p','k','fe','s'].map(key => (
                  <td key={key} className="wl-td-num">
                    <NutrientCell totalLbs={nuts[key]} lawnSqft={lawnSqft} />
                  </td>
                ))}
                <td style={{ fontSize: '0.82rem', color: '#6b7280' }}>{entry.spreader_setting || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="submit-btn secondary" style={{ padding: '3px 8px', fontSize: '0.78rem' }} onClick={() => onEdit(entry)}>Edit</button>
                    <button className="delete-btn" onClick={() => onDelete(entry.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function WorkLog() {
  const [entries, setEntries] = useState([])
  const [soilTests, setSoilTests] = useState([])
  const [plannedWork, setPlannedWork] = useState([])
  const [soilForm, setSoilForm] = useState(EMPTY_SOIL_FORM)
  const [planForm, setPlanForm] = useState(EMPTY_PLAN_FORM)
  const [activeTab, setActiveTab] = useState('plan') // 'plan' | 'soil'
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)
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

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/worklog').then(r => r.json()),
      fetch('/api/soiltest').then(r => r.json()),
      fetch('/api/planned-work').then(r => r.json()),
    ])
      .then(([settings, worklog, soiltests, planned]) => {
        setLawnSqft(settings.lawn_sqft ? parseFloat(settings.lawn_sqft) : null)
        setTargets({
          n_target: settings.n_target ? parseFloat(settings.n_target) : null,
          p_target: settings.p_target ? parseFloat(settings.p_target) : null,
          k_target: settings.k_target ? parseFloat(settings.k_target) : null,
          fe_target: settings.fe_target ? parseFloat(settings.fe_target) : null,
          s_target: settings.s_target ? parseFloat(settings.s_target) : null,
        })
        setEntries(worklog)
        setSoilTests(soiltests)
        setPlannedWork(planned)
      })
      .catch(err => console.error('Error fetching data:', err))
      .finally(() => setLoading(false))
  }, [])

  async function handleSoilSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/soiltest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(soilForm),
      })
      if (res.ok) {
        setSoilForm({ ...EMPTY_SOIL_FORM, date: todayString() })
        setSoilTests(await fetch('/api/soiltest').then(r => r.json()))
      }
    } catch (err) {
      console.error('Error creating soil test:', err)
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePlanSubmit(e) {
    e.preventDefault()
    if (!planForm.activity.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/planned-work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planForm),
      })
      if (res.ok) {
        setPlanForm({ ...EMPTY_PLAN_FORM, planned_date: todayString() })
        setPlannedWork(await fetch('/api/planned-work').then(r => r.json()))
      }
    } catch (err) {
      console.error('Error creating planned work entry:', err)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteWork(id) {
    try {
      const res = await fetch(`/api/worklog/${id}`, { method: 'DELETE' })
      if (res.ok) {
        const [worklog, planned] = await Promise.all([
          fetch('/api/worklog').then(r => r.json()),
          fetch('/api/planned-work').then(r => r.json()),
        ])
        setEntries(worklog)
        setPlannedWork(planned)
      }
    } catch (err) {
      console.error('Error deleting work log entry:', err)
    }
  }

  async function handleDeleteSoil(id) {
    try {
      const res = await fetch(`/api/soiltest/${id}`, { method: 'DELETE' })
      if (res.ok) setSoilTests(await fetch('/api/soiltest').then(r => r.json()))
    } catch (err) {
      console.error('Error deleting soil test:', err)
    }
  }

  async function handleDeletePlan(id) {
    try {
      const res = await fetch(`/api/planned-work/${id}`, { method: 'DELETE' })
      if (res.ok) setPlannedWork(await fetch('/api/planned-work').then(r => r.json()))
    } catch (err) {
      console.error('Error deleting planned work entry:', err)
    }
  }

  async function handleToggleComplete(id) {
    try {
      const res = await fetch(`/api/planned-work/${id}/complete`, { method: 'PATCH' })
      if (res.ok) {
        const [planned, worklog] = await Promise.all([
          fetch('/api/planned-work').then(r => r.json()),
          fetch('/api/worklog').then(r => r.json()),
        ])
        setPlannedWork(planned)
        setEntries(worklog)
      }
    } catch (err) {
      console.error('Error toggling planned work completion:', err)
    }
  }

  function startEdit(entry) {
    setEditingId(entry.id)
    setEditForm({
      planned_date: entry.planned_date,
      activity: entry.activity,
      notes: entry.notes || '',
      n_pct: entry.n_pct ?? '',
      p_pct: entry.p_pct ?? '',
      k_pct: entry.k_pct ?? '',
      fe_pct: entry.fe_pct ?? '',
      s_pct: entry.s_pct ?? '',
      lbs_planned: entry.lbs_planned ?? '',
      spreader_setting: entry.spreader_setting || '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(null)
  }

  async function handleEditSubmit(e, id) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch(`/api/planned-work/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        setEditingId(null)
        setEditForm(null)
        setPlannedWork(await fetch('/api/planned-work').then(r => r.json()))
      }
    } catch (err) {
      console.error('Error updating planned work entry:', err)
    } finally {
      setSubmitting(false)
    }
  }

  // Calculate yearly totals for current year from work_log entries
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

  // Calculate planned (incomplete) totals for current year
  function getPlannedTotals() {
    const currentYear = new Date().getFullYear()
    const pending = plannedWork.filter(p => !p.completed && p.planned_date.startsWith(currentYear.toString()))

    let n_total = 0, p_total = 0, k_total = 0, fe_total = 0, s_total = 0

    pending.forEach(entry => {
      const lbs = entry.lbs_planned ? parseFloat(entry.lbs_planned) : 0
      if (entry.n_pct && lbs) n_total += (parseFloat(entry.n_pct) / 100) * lbs
      if (entry.p_pct && lbs) p_total += (parseFloat(entry.p_pct) / 100) * lbs
      if (entry.k_pct && lbs) k_total += (parseFloat(entry.k_pct) / 100) * lbs
      if (entry.fe_pct && lbs) fe_total += (parseFloat(entry.fe_pct) / 100) * lbs
      if (entry.s_pct && lbs) s_total += (parseFloat(entry.s_pct) / 100) * lbs
    })

    return { n_total, p_total, k_total, fe_total, s_total }
  }

  // Most recent soil test (already sorted DESC by date from API)
  const latestSoilTest = soilTests.length > 0 ? soilTests[0] : null
  const adjustedTargets = applySoilAdjustments(targets, lawnSqft, latestSoilTest)

  const hasPendingPlanned = plannedWork.some(p => !p.completed)

  return (
    <>
      {/* Yearly nutrient totals */}
      {!loading && (
        <div className="card">
          <h2>Yearly Nutrient Summary</h2>
          {latestSoilTest && (
            <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '12px' }}>
              Targets adjusted from soil test on {latestSoilTest.date}
            </div>
          )}
          {(() => {
            const { n_total, p_total, k_total, fe_total, s_total } = getYearlyTotals()
            const planned = getPlannedTotals()
            const hasTargets = adjustedTargets.n_target || adjustedTargets.p_target || adjustedTargets.k_target || adjustedTargets.fe_target || adjustedTargets.s_target

            if (!hasTargets) {
              return <div className="empty-state">Set nutrient targets in settings and log work to see progress.</div>
            }

            const nutrients = [
              adjustedTargets.n_target && { label: 'Nitrogen',   symbol: 'N',  total: n_total,  target: adjustedTargets.n_target,  adjusted: adjustedTargets.adjusted.n,  plannedTotal: planned.n_total },
              adjustedTargets.p_target !== null && adjustedTargets.p_target > 0 && { label: 'Phosphorus', symbol: 'P',  total: p_total,  target: adjustedTargets.p_target,  adjusted: adjustedTargets.adjusted.p,  plannedTotal: planned.p_total },
              adjustedTargets.k_target !== null && adjustedTargets.k_target > 0 && { label: 'Potassium',  symbol: 'K',  total: k_total,  target: adjustedTargets.k_target,  adjusted: adjustedTargets.adjusted.k,  plannedTotal: planned.k_total },
              adjustedTargets.fe_target && { label: 'Iron',      symbol: 'Fe', total: fe_total, target: adjustedTargets.fe_target, adjusted: adjustedTargets.adjusted.fe,  plannedTotal: planned.fe_total },
              adjustedTargets.s_target && { label: 'Sulfur',     symbol: 'S',  total: s_total,  target: adjustedTargets.s_target,  adjusted: adjustedTargets.adjusted.s,  plannedTotal: planned.s_total },
            ].filter(Boolean)

            const skipped = [
              adjustedTargets.adjusted.p && adjustedTargets.p_target === 0 && 'P (soil level high)',
              adjustedTargets.adjusted.k && adjustedTargets.k_target === 0 && 'K (soil level high)',
              adjustedTargets.adjusted.fe && adjustedTargets.fe_target === 0 && 'Fe (soil level high)',
              adjustedTargets.adjusted.s && adjustedTargets.s_target === 0 && 'S (soil pH too low)',
            ].filter(Boolean)

            return (
              <>
                <div className="nutrient-gauges">
                  {nutrients.map(n => (
                    <NutrientGaugeCard key={n.symbol} {...n} />
                  ))}
                </div>
                {hasPendingPlanned && (
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ display: 'inline-block', width: '20px', height: '6px', borderRadius: '3px', background: 'rgba(100,100,100,0.25)' }} />
                    Faded arc shows planned (not yet applied) applications
                  </div>
                )}
                {skipped.length > 0 && (
                  <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '6px' }}>
                    Skipped (soil level high): {skipped.join(', ')}
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}

      {/* Add form */}
      <div className="card">
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <button
            type="button"
            className={activeTab === 'plan' ? 'submit-btn' : 'submit-btn secondary'}
            style={{ flex: 1 }}
            onClick={() => setActiveTab('plan')}
          >
            Plan Work
          </button>
          <button
            type="button"
            className={activeTab === 'soil' ? 'submit-btn' : 'submit-btn secondary'}
            style={{ flex: 1 }}
            onClick={() => setActiveTab('soil')}
          >
            Log Soil Test
          </button>
        </div>

        {activeTab === 'plan' && (
          <form onSubmit={handlePlanSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="planned_date">Planned Date</label>
                <input
                  id="planned_date"
                  type="date"
                  value={planForm.planned_date}
                  onChange={(e) => setPlanForm({ ...planForm, planned_date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="plan_activity">Product</label>
                <input
                  id="plan_activity"
                  type="text"
                  placeholder="e.g. Milorganite 6-4-0"
                  value={planForm.activity}
                  onChange={(e) => setPlanForm({ ...planForm, activity: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="plan_notes">Notes</label>
              <textarea
                id="plan_notes"
                placeholder="Optional notes..."
                value={planForm.notes}
                onChange={(e) => setPlanForm({ ...planForm, notes: e.target.value })}
              />
            </div>

            <div className="form-section-header">Product Details</div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="plan_n_pct">Nitrogen (N) %</label>
                <input
                  id="plan_n_pct"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 46"
                  value={planForm.n_pct}
                  onChange={(e) => setPlanForm({ ...planForm, n_pct: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="plan_p_pct">Phosphorus (P) %</label>
                <input
                  id="plan_p_pct"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 0"
                  value={planForm.p_pct}
                  onChange={(e) => setPlanForm({ ...planForm, p_pct: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="plan_k_pct">Potassium (K) %</label>
                <input
                  id="plan_k_pct"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 0"
                  value={planForm.k_pct}
                  onChange={(e) => setPlanForm({ ...planForm, k_pct: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="plan_fe_pct">Iron (Fe) %</label>
                <input
                  id="plan_fe_pct"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 0"
                  value={planForm.fe_pct}
                  onChange={(e) => setPlanForm({ ...planForm, fe_pct: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="plan_s_pct">Sulfur (S) %</label>
                <input
                  id="plan_s_pct"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 0"
                  value={planForm.s_pct}
                  onChange={(e) => setPlanForm({ ...planForm, s_pct: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="plan_lbs_planned">Pounds Planned</label>
                <input
                  id="plan_lbs_planned"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 10.5"
                  value={planForm.lbs_planned}
                  onChange={(e) => setPlanForm({ ...planForm, lbs_planned: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="plan_spreader_setting">Spreader Setting</label>
                <input
                  id="plan_spreader_setting"
                  type="text"
                  placeholder="e.g. 18"
                  value={planForm.spreader_setting}
                  onChange={(e) => setPlanForm({ ...planForm, spreader_setting: e.target.value })}
                />
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={submitting}>
              {submitting ? 'Saving...' : 'Add to Plan'}
            </button>
          </form>
        )}

        {activeTab === 'soil' && (
          <form onSubmit={handleSoilSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="soil-date">Date</label>
                <input
                  id="soil-date"
                  type="date"
                  value={soilForm.date}
                  onChange={(e) => setSoilForm({ ...soilForm, date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-section-header">Soil Test Results</div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="ph">pH</label>
                <input
                  id="ph"
                  type="number"
                  step="0.1"
                  min="0"
                  max="14"
                  placeholder="e.g. 6.5"
                  value={soilForm.ph}
                  onChange={(e) => setSoilForm({ ...soilForm, ph: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="om_pct">Organic Matter (%)</label>
                <input
                  id="om_pct"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g. 3.2"
                  value={soilForm.om_pct}
                  onChange={(e) => setSoilForm({ ...soilForm, om_pct: e.target.value })}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="p_ppm">Phosphorus (ppm)</label>
                <input
                  id="p_ppm"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="e.g. 25"
                  value={soilForm.p_ppm}
                  onChange={(e) => setSoilForm({ ...soilForm, p_ppm: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="k_ppm">Potassium (ppm)</label>
                <input
                  id="k_ppm"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="e.g. 130"
                  value={soilForm.k_ppm}
                  onChange={(e) => setSoilForm({ ...soilForm, k_ppm: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="fe_ppm">Iron — DTPA (ppm)</label>
                <input
                  id="fe_ppm"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g. 8.5"
                  value={soilForm.fe_ppm}
                  onChange={(e) => setSoilForm({ ...soilForm, fe_ppm: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="soil-notes">Notes</label>
              <textarea
                id="soil-notes"
                placeholder="e.g. ISU Extension soil test"
                value={soilForm.notes}
                onChange={(e) => setSoilForm({ ...soilForm, notes: e.target.value })}
              />
            </div>

            <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '12px' }}>
              P and K adjust yearly targets. Organic matter adjusts nitrogen. Iron (DTPA) adjusts iron target when tested.
            </div>

            <button type="submit" className="submit-btn" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Soil Test'}
            </button>
          </form>
        )}
      </div>

      {/* Planned work */}
      {plannedWork.some(p => !p.completed) && (
        <div className="card">
          <h2>Planned Work</h2>
          <PlanTable
            entries={plannedWork.filter(p => !p.completed)}
            lawnSqft={lawnSqft}
            editingId={editingId}
            editForm={editForm}
            setEditForm={setEditForm}
            submitting={submitting}
            onToggle={handleToggleComplete}
            onEdit={startEdit}
            onCancelEdit={cancelEdit}
            onEditSubmit={handleEditSubmit}
            onDelete={handleDeletePlan}
          />
        </div>
      )}

      {/* Work history */}
      <div className="card">
        <h2>Work History</h2>
        {loading ? (
          <div className="loading">Loading work log...</div>
        ) : entries.length === 0 ? (
          <div className="empty-state">No work logged yet.</div>
        ) : (
          <HistoryTable entries={entries} lawnSqft={lawnSqft} onDelete={handleDeleteWork} />
        )}
      </div>

      {/* Soil test history */}
      {soilTests.length > 0 && (
        <div className="card">
          <h2>Soil Test History</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="wl-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>pH</th>
                  <th>OM (%)</th>
                  <th>P (ppm)</th>
                  <th>K (ppm)</th>
                  <th>Fe DTPA (ppm)</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {soilTests.map(test => (
                  <tr key={test.id}>
                    <td className="wl-td-date">{test.date}</td>
                    <td className="wl-td-num">{test.ph ?? '—'}</td>
                    <td className="wl-td-num">{test.om_pct ?? '—'}</td>
                    <td className="wl-td-num">{test.p_ppm ?? '—'}</td>
                    <td className="wl-td-num">{test.k_ppm ?? '—'}</td>
                    <td className="wl-td-num">{test.fe_ppm ?? '—'}</td>
                    <td style={{ fontSize: '0.82rem', color: '#6b7280' }}>{test.notes || '—'}</td>
                    <td><button className="delete-btn" onClick={() => handleDeleteSoil(test.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
