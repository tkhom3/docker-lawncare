import { useEffect, useState } from 'react'

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

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
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
      .then(r => r.ok ? setStatus('saved') : setStatus('error'))
      .catch(() => setStatus('error'))
  }

  // Calculate recommended nutrient targets based on lawn size
  // For cool season grass (midwest): lbs per 1000 sq ft
  function getRecommendations() {
    const sqft = parseFloat(form.lawn_sqft) || 0
    if (sqft <= 0) return null
    
    const thousand = sqft / 1000
    return {
      n_target: (16 * thousand).toFixed(1),
      p_target: (2.5 * thousand).toFixed(1),
      k_target: (5 * thousand).toFixed(1),
      fe_target: (0.3 * thousand).toFixed(1),
      s_target: (1 * thousand).toFixed(1),
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
            Used by the weather collector. Changes take effect on the next scheduled collection (6:00 AM daily).
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
            return recommendations ? (
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
                <div className="nutrient-input-group">
                  <div className="nutrient-input-pair">
                    <div className="nutrient-input-item">
                      <label>
                        Nitrogen (N)
                        <input
                          type="number"
                          name="n_target"
                          value={form.n_target}
                          onChange={handleChange}
                          min="0"
                          step="0.1"
                          placeholder="e.g. 100"
                        />
                      </label>
                    </div>
                    <div className="nutrient-recommendation">
                      Recommended: <strong>{recommendations.n_target} lbs</strong>
                    </div>
                  </div>

                  <div className="nutrient-input-pair">
                    <div className="nutrient-input-item">
                      <label>
                        Phosphorus (P)
                        <input
                          type="number"
                          name="p_target"
                          value={form.p_target}
                          onChange={handleChange}
                          min="0"
                          step="0.1"
                          placeholder="e.g. 30"
                        />
                      </label>
                    </div>
                    <div className="nutrient-recommendation">
                      Recommended: <strong>{recommendations.p_target} lbs</strong>
                    </div>
                  </div>

                  <div className="nutrient-input-pair">
                    <div className="nutrient-input-item">
                      <label>
                        Potassium (K)
                        <input
                          type="number"
                          name="k_target"
                          value={form.k_target}
                          onChange={handleChange}
                          min="0"
                          step="0.1"
                          placeholder="e.g. 60"
                        />
                      </label>
                    </div>
                    <div className="nutrient-recommendation">
                      Recommended: <strong>{recommendations.k_target} lbs</strong>
                    </div>
                  </div>

                  <div className="nutrient-input-pair">
                    <div className="nutrient-input-item">
                      <label>
                        Iron (Fe)
                        <input
                          type="number"
                          name="fe_target"
                          value={form.fe_target}
                          onChange={handleChange}
                          min="0"
                          step="0.1"
                          placeholder="e.g. 5"
                        />
                      </label>
                    </div>
                    <div className="nutrient-recommendation">
                      Recommended: <strong>{recommendations.fe_target} lbs</strong>
                    </div>
                  </div>

                  <div className="nutrient-input-pair">
                    <div className="nutrient-input-item">
                      <label>
                        Sulfur (S)
                        <input
                          type="number"
                          name="s_target"
                          value={form.s_target}
                          onChange={handleChange}
                          min="0"
                          step="0.1"
                          placeholder="e.g. 20"
                        />
                      </label>
                    </div>
                    <div className="nutrient-recommendation">
                      Recommended: <strong>{recommendations.s_target} lbs</strong>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="settings-note">Enter your lawn size above to see nutrient recommendations.</div>
            )
          })()}
        </div>

        <div className="settings-actions">
          <button type="submit" className="save-btn">Save Settings</button>
          {status === 'saved' && <span className="status-ok">Saved</span>}
          {status === 'error' && <span className="status-err">Error saving settings</span>}
        </div>
      </form>
    </div>
  )
}
