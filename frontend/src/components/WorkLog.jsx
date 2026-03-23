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
  const pct = Math.min((total / target) * 100, 100)
  const plannedPct = plannedTotal != null ? ((total + plannedTotal) / target) * 100 : null
  const statusColor = pct < 40 ? '#ef4444' : pct < 72 ? '#f59e0b' : '#16a34a'
  const statusLabel = pct < 40 ? 'LOW' : pct < 72 ? 'ON TRACK' : 'GREAT'
  const [tipX, tipY] = arcPoint(pct / 100)
  const valText = plannedTotal != null && plannedTotal > 0
    ? `${total.toFixed(1)} + ${plannedTotal.toFixed(1)} planned / ${target.toFixed(1)} lbs`
    : `${total.toFixed(1)} / ${target.toFixed(1)} lbs`

  return (
    <div className="ng-card">
      <ArcBase color={statusColor} pct={pct} plannedPct={plannedPct} viewH={58}>
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

const EMPTY_WORK_FORM = {
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
}

const EMPTY_SOIL_FORM = {
  date: todayString(),
  notes: '',
  ph: '',
  om_pct: '',
  p_ppm: '',
  k_ppm: '',
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

export default function WorkLog() {
  const [entries, setEntries] = useState([])
  const [soilTests, setSoilTests] = useState([])
  const [plannedWork, setPlannedWork] = useState([])
  const [workForm, setWorkForm] = useState(EMPTY_WORK_FORM)
  const [soilForm, setSoilForm] = useState(EMPTY_SOIL_FORM)
  const [planForm, setPlanForm] = useState(EMPTY_PLAN_FORM)
  const [activeTab, setActiveTab] = useState('work') // 'work' | 'plan' | 'soil'
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

  async function handleWorkSubmit(e) {
    e.preventDefault()
    if (!workForm.activity.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/worklog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workForm),
      })
      if (res.ok) {
        setWorkForm({ ...EMPTY_WORK_FORM, date: todayString() })
        setEntries(await fetch('/api/worklog').then(r => r.json()))
      }
    } catch (err) {
      console.error('Error creating work log entry:', err)
    } finally {
      setSubmitting(false)
    }
  }

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
      if (res.ok) setEntries(await fetch('/api/worklog').then(r => r.json()))
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
              adjustedTargets.fe_target && { label: 'Iron',      symbol: 'Fe', total: fe_total, target: adjustedTargets.fe_target, adjusted: false,                        plannedTotal: planned.fe_total },
              adjustedTargets.s_target && { label: 'Sulfur',     symbol: 'S',  total: s_total,  target: adjustedTargets.s_target,  adjusted: false,                        plannedTotal: planned.s_total },
            ].filter(Boolean)

            const skipped = [
              adjustedTargets.adjusted.p && adjustedTargets.p_target === 0 && 'P (soil level high)',
              adjustedTargets.adjusted.k && adjustedTargets.k_target === 0 && 'K (soil level high)',
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

      {/* Log form with tab switcher */}
      <div className="card">
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <button
            type="button"
            className={activeTab === 'work' ? 'submit-btn' : 'submit-btn secondary'}
            style={{ flex: 1 }}
            onClick={() => setActiveTab('work')}
          >
            Log Work
          </button>
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

        {activeTab === 'work' && (
          <form onSubmit={handleWorkSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="date">Date</label>
                <input
                  id="date"
                  type="date"
                  value={workForm.date}
                  onChange={(e) => setWorkForm({ ...workForm, date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="activity">Activity</label>
                <input
                  id="activity"
                  type="text"
                  placeholder="e.g. Applied fertilizer"
                  value={workForm.activity}
                  onChange={(e) => setWorkForm({ ...workForm, activity: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                placeholder="Optional notes..."
                value={workForm.notes}
                onChange={(e) => setWorkForm({ ...workForm, notes: e.target.value })}
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
                  value={workForm.n_pct}
                  onChange={(e) => setWorkForm({ ...workForm, n_pct: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="p_pct">Phosphorus (P) %</label>
                <input
                  id="p_pct"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 0"
                  value={workForm.p_pct}
                  onChange={(e) => setWorkForm({ ...workForm, p_pct: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="k_pct">Potassium (K) %</label>
                <input
                  id="k_pct"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 0"
                  value={workForm.k_pct}
                  onChange={(e) => setWorkForm({ ...workForm, k_pct: e.target.value })}
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
                  value={workForm.fe_pct}
                  onChange={(e) => setWorkForm({ ...workForm, fe_pct: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="s_pct">Sulfur (S) %</label>
                <input
                  id="s_pct"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 0"
                  value={workForm.s_pct}
                  onChange={(e) => setWorkForm({ ...workForm, s_pct: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="lbs_applied">Pounds Applied</label>
                <input
                  id="lbs_applied"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 10.5"
                  value={workForm.lbs_applied}
                  onChange={(e) => setWorkForm({ ...workForm, lbs_applied: e.target.value })}
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
                  value={workForm.spreader_setting}
                  onChange={(e) => setWorkForm({ ...workForm, spreader_setting: e.target.value })}
                />
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={submitting}>
              {submitting ? 'Saving...' : 'Log Work'}
            </button>
          </form>
        )}

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
                <label htmlFor="plan_activity">Activity</label>
                <input
                  id="plan_activity"
                  type="text"
                  placeholder="e.g. Apply fall fertilizer"
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
              P and K readings adjust yearly targets. Organic matter adjusts nitrogen target.
            </div>

            <button type="submit" className="submit-btn" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Soil Test'}
            </button>
          </form>
        )}
      </div>

      {/* Planned work list */}
      {plannedWork.some(p => !p.completed) && (
        <div className="card">
          <h2>Planned Work</h2>
          <div className="worklog-entries">
            {plannedWork.filter(p => !p.completed).map((entry) => {
              const lbs = entry.lbs_planned ? parseFloat(entry.lbs_planned) : null
              const perThousandSqft = lbs && lawnSqft ? (lbs / (lawnSqft / 1000)) : null

              if (editingId === entry.id) {
                return (
                  <div key={entry.id} className="worklog-entry">
                    <form onSubmit={(e) => handleEditSubmit(e, entry.id)}>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Planned Date</label>
                          <input type="date" value={editForm.planned_date}
                            onChange={(e) => setEditForm({ ...editForm, planned_date: e.target.value })} required />
                        </div>
                        <div className="form-group">
                          <label>Activity</label>
                          <input type="text" value={editForm.activity}
                            onChange={(e) => setEditForm({ ...editForm, activity: e.target.value })} required />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Notes</label>
                        <textarea value={editForm.notes}
                          onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                      </div>
                      <div className="form-section-header">Product Details</div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>N %</label>
                          <input type="number" step="0.01" value={editForm.n_pct}
                            onChange={(e) => setEditForm({ ...editForm, n_pct: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label>P %</label>
                          <input type="number" step="0.01" value={editForm.p_pct}
                            onChange={(e) => setEditForm({ ...editForm, p_pct: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label>K %</label>
                          <input type="number" step="0.01" value={editForm.k_pct}
                            onChange={(e) => setEditForm({ ...editForm, k_pct: e.target.value })} />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Fe %</label>
                          <input type="number" step="0.01" value={editForm.fe_pct}
                            onChange={(e) => setEditForm({ ...editForm, fe_pct: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label>S %</label>
                          <input type="number" step="0.01" value={editForm.s_pct}
                            onChange={(e) => setEditForm({ ...editForm, s_pct: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label>Pounds Planned</label>
                          <input type="number" step="0.1" value={editForm.lbs_planned}
                            onChange={(e) => setEditForm({ ...editForm, lbs_planned: e.target.value })} />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Spreader Setting</label>
                          <input type="text" value={editForm.spreader_setting}
                            onChange={(e) => setEditForm({ ...editForm, spreader_setting: e.target.value })} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="submit" className="submit-btn" disabled={submitting}>
                          {submitting ? 'Saving...' : 'Save'}
                        </button>
                        <button type="button" className="submit-btn secondary" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )
              }

              return (
                <div key={entry.id} className="worklog-entry" style={{ opacity: entry.completed ? 0.55 : 1 }}>
                  <div className="entry-header">
                    <div className="entry-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="checkbox"
                        checked={!!entry.completed}
                        onChange={() => handleToggleComplete(entry.id)}
                        style={{ width: '17px', height: '17px', cursor: 'pointer', accentColor: '#16a34a', flexShrink: 0 }}
                        title={entry.completed ? 'Mark as not done' : 'Mark as done'}
                      />
                      <span className="entry-date" style={{ textDecoration: entry.completed ? 'line-through' : 'none' }}>
                        {entry.planned_date}
                      </span>
                      <span className="entry-activity" style={{ textDecoration: entry.completed ? 'line-through' : 'none' }}>
                        {entry.activity}
                      </span>
                      {entry.completed && (
                        <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 600, background: '#dcfce7', padding: '2px 7px', borderRadius: '10px' }}>
                          Done
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {!entry.completed && (
                        <button className="submit-btn secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                          onClick={() => startEdit(entry)}>
                          Edit
                        </button>
                      )}
                      <button
                        className="delete-btn"
                        onClick={() => handleDeletePlan(entry.id)}
                        title="Delete planned entry"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {entry.notes && <div className="entry-notes"><strong>Notes:</strong> {entry.notes}</div>}

                  {entry.spreader_setting && (
                    <div className="entry-field">
                      <strong>Spreader Setting:</strong> {entry.spreader_setting}
                    </div>
                  )}

                  {lbs && (
                    <div className="entry-field">
                      <strong>Pounds Planned:</strong> {lbs.toFixed(2)} lbs
                      {perThousandSqft && (
                        <span className="secondary"> ({perThousandSqft.toFixed(2)} lbs per 1000 sqft)</span>
                      )}
                    </div>
                  )}

                  {lbs && (entry.n_pct || entry.p_pct || entry.k_pct || entry.fe_pct || entry.s_pct) && (
                    <div className="entry-nutrients">
                      <div className="nutrient-row">
                        {entry.n_pct ? <div className="nutrient"><span className="nutrient-label">N:</span><span className="nutrient-value">{((entry.n_pct / 100) * lbs).toFixed(2)} lbs</span></div> : null}
                        {entry.p_pct ? <div className="nutrient"><span className="nutrient-label">P:</span><span className="nutrient-value">{((entry.p_pct / 100) * lbs).toFixed(2)} lbs</span></div> : null}
                        {entry.k_pct ? <div className="nutrient"><span className="nutrient-label">K:</span><span className="nutrient-value">{((entry.k_pct / 100) * lbs).toFixed(2)} lbs</span></div> : null}
                        {entry.fe_pct ? <div className="nutrient"><span className="nutrient-label">Fe:</span><span className="nutrient-value">{((entry.fe_pct / 100) * lbs).toFixed(2)} lbs</span></div> : null}
                        {entry.s_pct ? <div className="nutrient"><span className="nutrient-label">S:</span><span className="nutrient-value">{((entry.s_pct / 100) * lbs).toFixed(2)} lbs</span></div> : null}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

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

              const n_per_k = n_total && lawnSqft ? n_total / (lawnSqft / 1000) : null
              const p_per_k = p_total && lawnSqft ? p_total / (lawnSqft / 1000) : null
              const k_per_k = k_total && lawnSqft ? k_total / (lawnSqft / 1000) : null
              const fe_per_k = fe_total && lawnSqft ? fe_total / (lawnSqft / 1000) : null
              const s_per_k = s_total && lawnSqft ? s_total / (lawnSqft / 1000) : null

              return (
                <div key={entry.id} className="worklog-entry">
                  <div className="entry-header">
                    <div className="entry-title">
                      <span className="entry-date">{entry.date}</span>
                      <span className="entry-activity">{entry.activity}</span>
                    </div>
                    <button
                      className="delete-btn"
                      onClick={() => handleDeleteWork(entry.id)}
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

      {/* Soil test history */}
      {soilTests.length > 0 && (
        <div className="card">
          <h2>Soil Test History</h2>
          <div className="worklog-entries">
            {soilTests.map((test) => {
              const fields = [
                soilTestLabel('pH', test.ph, ''),
                soilTestLabel('OM', test.om_pct, '%'),
                soilTestLabel('P', test.p_ppm, ' ppm'),
                soilTestLabel('K', test.k_ppm, ' ppm'),
              ].filter(Boolean)

              return (
                <div key={test.id} className="worklog-entry">
                  <div className="entry-header">
                    <div className="entry-title">
                      <span className="entry-date">{test.date}</span>
                      <span className="entry-activity">Soil Test</span>
                    </div>
                    <button
                      className="delete-btn"
                      onClick={() => handleDeleteSoil(test.id)}
                      title="Delete soil test"
                    >
                      Delete
                    </button>
                  </div>
                  {fields.length > 0 && (
                    <div className="entry-nutrients">
                      <div className="nutrient-row">
                        {fields.map(f => (
                          <div key={f} className="nutrient">
                            <span className="nutrient-value">{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {test.notes && <div className="entry-notes"><strong>Notes:</strong> {test.notes}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
