import { useEffect, useRef, useState } from 'react'

export default function Settings() {
  const [form, setForm] = useState({
    lat: '',
    long: '',
    lawn_sqft: '',
    vc_api_key: '',
    n_target: '',
    p_target: '',
    k_target: '',
    fe_target: '',
    s_target: '',
  })
  const [status, setStatus] = useState(null) // 'saved' | 'error'
  const [loading, setLoading] = useState(true)
  const [showKey, setShowKey] = useState(false)
  const [apiKeySet, setApiKeySet] = useState(false)
  const [collectorLog, setCollectorLog] = useState([]) // { level, message }[]
  const [collectingDone, setCollectingDone] = useState(false)
  const [latestSoilTest, setLatestSoilTest] = useState(null)
  const logEndRef = useRef(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/soiltest').then(r => r.json()),
    ])
      .then(([data, soiltests]) => {
        setApiKeySet(!!data.vc_api_key)
        setForm({
          lat: data.lat || '',
          long: data.long || '',
          lawn_sqft: data.lawn_sqft || '',
          vc_api_key: '',
          n_target: data.n_target || '',
          p_target: data.p_target || '',
          k_target: data.k_target || '',
          fe_target: data.fe_target || '',
          s_target: data.s_target || '',
        })
        setLatestSoilTest(soiltests.length > 0 ? soiltests[0] : null)
      })
      .catch(() => setStatus('error'))
      .finally(() => setLoading(false))
  }, [])

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setStatus(null)
  }

  function handleSubmit(e) {
    e.preventDefault()
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        setStatus('saved')
        if (data.backfillTriggered) {
          setCollectorLog([])
          setCollectingDone(false)
          // Get current log position then open SSE from there
          fetch('/api/status/position')
            .then(r => r.json())
            .then(({ id }) => {
              const es = new EventSource(`/api/status/stream?since_id=${id}`)
              es.onmessage = (e) => {
                const entry = JSON.parse(e.data)
                setCollectorLog(prev => [...prev, entry])
                if (entry.level === 'done') {
                  setCollectingDone(true)
                  es.close()
                }
              }
              es.onerror = () => es.close()
            })
        }
      })
      .catch(() => setStatus('error'))
  }

  // Auto-scroll log to bottom as new entries arrive
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [collectorLog])

  // Calculate recommended nutrient targets based on lawn size + soil test adjustments
  // Base values for cool season grass (midwest): lbs per 1000 sq ft
  // Soil test multipliers follow ISU Midwest thresholds (same as WorkLog)
  function getRecommendations() {
    const sqft = parseFloat(form.lawn_sqft) || 0
    if (sqft <= 0) return null

    const thousand = sqft / 1000
    const base = {
      n: 4 * thousand,
      p: 2.5 * thousand,
      k: 5 * thousand,
      fe: 0.3 * thousand,
      s: 1 * thousand,
    }
    const adjusted = { n: false, p: false, k: false, fe: false, s: false }

    if (latestSoilTest) {
      const { p_ppm, k_ppm, om_pct, fe_ppm, ph } = latestSoilTest

      if (p_ppm != null) {
        const m = p_ppm < 15 ? 1.0 : p_ppm < 30 ? 0.75 : p_ppm < 50 ? 0.5 : 0.0
        if (m !== 1.0) { base.p *= m; adjusted.p = true }
      }
      if (k_ppm != null) {
        const m = k_ppm < 100 ? 1.0 : k_ppm < 150 ? 0.75 : k_ppm < 200 ? 0.5 : 0.0
        if (m !== 1.0) { base.k *= m; adjusted.k = true }
      }
      if (om_pct != null) {
        const m = om_pct > 5 ? 0.8 : om_pct > 3 ? 0.9 : 1.0
        if (m !== 1.0) { base.n *= m; adjusted.n = true }
      }
      // Iron: DTPA Fe thresholds — < 4.5 ppm low (full), 4.5–10 ppm adequate (50%), ≥ 10 ppm high (skip)
      if (fe_ppm != null) {
        const m = fe_ppm < 4.5 ? 1.0 : fe_ppm < 10 ? 0.5 : 0.0
        if (m !== 1.0) { base.fe *= m; adjusted.fe = true }
      }
      // Sulfur: pH thresholds — < 5.5 skip (too acidic), 5.5–6.5 half rate, ≥ 6.5 full rate
      if (ph != null) {
        const m = ph < 5.5 ? 0.0 : ph < 6.5 ? 0.5 : 1.0
        if (m !== 1.0) { base.s *= m; adjusted.s = true }
      }
    }

    return {
      n_target: base.n.toFixed(1),
      p_target: base.p.toFixed(1),
      k_target: base.k.toFixed(1),
      fe_target: base.fe.toFixed(1),
      s_target: base.s.toFixed(1),
      adjusted,
    }
  }

  function applyRecommendations() {
    const recommendations = getRecommendations()
    if (recommendations) {
      setForm(f => ({ ...f, ...recommendations }))
      setStatus(null)
    }
  }

  if (loading) return <div className="loading">Loading settings...</div>

  return (
    <div className="card">
      <h2>Property Settings</h2>
      <form onSubmit={handleSubmit} className="settings-form">
        <div className="settings-group">
          <h3>API Keys</h3>
          <label>
            Visual Crossing API Key
            <div className="input-reveal">
              <input
                type={showKey ? 'text' : 'password'}
                name="vc_api_key"
                value={form.vc_api_key}
                onChange={handleChange}
                placeholder={apiKeySet ? 'API key is set — enter new value to change' : 'Enter your API key'}
                autoComplete="off"
              />
              <button type="button" className="reveal-btn" onClick={() => setShowKey(s => !s)}>
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>
        </div>

        <div className="settings-group">
          <h3>Location</h3>
          <p className="gdd-note">
            Used by the weather collector. Changes take effect on the next scheduled collection (00:00 daily).
          </p>
          <label>
            Latitude
            <input
              type="number"
              name="lat"
              value={form.lat}
              onChange={handleChange}
              step="any"
              placeholder="e.g. 41.615"
            />
          </label>
          <label>
            Longitude
            <input
              type="number"
              name="long"
              value={form.long}
              onChange={handleChange}
              step="any"
              placeholder="e.g. -93.823"
            />
          </label>
        </div>

        <div className="settings-group">
          <h3>Property</h3>
          <label>
            Lawn Size (sq ft)
            <input
              type="number"
              name="lawn_sqft"
              value={form.lawn_sqft}
              onChange={handleChange}
              min="0"
              placeholder="e.g. 8500"
            />
          </label>
        </div>

        <div className="settings-group">
          <h3>Yearly Nutrient Targets (lbs)</h3>
          <p className="gdd-note">
            Set target amounts for each nutrient to track progress throughout the year.
          </p>
          
          {(() => {
            const recommendations = getRecommendations()
            if (!recommendations) {
              return <div className="settings-note">Enter your lawn size above to see nutrient recommendations.</div>
            }
            const { adjusted } = recommendations
            const anySoilAdjusted = adjusted.n || adjusted.p || adjusted.k || adjusted.fe || adjusted.s
            return (
              <div className="recommendations-section">
                <div className="recommendations-header">
                  <span className="recommendations-title">Cool Season Grass Recommendations</span>
                  <button
                    type="button"
                    className="apply-recommendations-btn"
                    onClick={applyRecommendations}
                  >
                    Apply Recommendations
                  </button>
                </div>
                {anySoilAdjusted && latestSoilTest && (
                  <div className="settings-note" style={{ marginBottom: '10px' }}>
                    Adjusted from soil test on {latestSoilTest.date}
                  </div>
                )}
                <div className="nutrient-input-group">
                  {[
                    { key: 'n_target', label: 'Nitrogen (N)',   adj: adjusted.n },
                    { key: 'p_target', label: 'Phosphorus (P)', adj: adjusted.p },
                    { key: 'k_target', label: 'Potassium (K)',  adj: adjusted.k },
                    { key: 'fe_target', label: 'Iron (Fe)',     adj: adjusted.fe },
                    { key: 's_target', label: 'Sulfur (S)',     adj: adjusted.s },
                  ].map(({ key, label, adj }) => (
                    <div key={key} className="nutrient-input-pair">
                      <div className="nutrient-input-header">
                        <span className="nutrient-input-label">{label}</span>
                        <span className="nutrient-recommendation">
                          Rec: <strong>{recommendations[key]} lbs</strong>
                          {adj && <span className="soil-adjusted-tag">soil-adjusted</span>}
                        </span>
                      </div>
                      <input
                        type="number"
                        name={key}
                        value={form[key]}
                        onChange={handleChange}
                        min="0"
                        step="0.1"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>

        <div className="settings-actions">
          <button type="submit" className="save-btn">Save Settings</button>
          {status === 'saved' && <span className="status-ok">Saved</span>}
          {status === 'error' && <span className="status-err">Error saving settings</span>}
        </div>

        {collectorLog.length > 0 && (
          <div className="collector-log">
            <h3 className="collector-log-title">
              {collectingDone ? 'Collection complete' : 'Collecting data\u2026'}
            </h3>
            <div className="collector-log-entries">
              {collectorLog.map((entry, i) => (
                <div key={i} className={`collector-log-entry collector-log-${entry.level}`}>
                  <span className="collector-log-msg">{entry.message}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
