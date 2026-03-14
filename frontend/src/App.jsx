import { useState, useEffect } from 'react'
import WeatherChart from './components/WeatherChart'
import WorkLog from './components/WorkLog'
import DollarSpotChart from './components/DollarSpotChart'
import GrowthPotentialChart from './components/GrowthPotentialChart'
import Predictions from './components/Predictions'
import Settings from './components/Settings'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

export default function App() {
  const TABS = ['weather', 'predictions', 'dollarspot', 'worklog', 'settings']

  function getTabFromHash() {
    const hash = window.location.hash.slice(1)
    return TABS.includes(hash) ? hash : 'weather'
  }

  const [activeTab, setActiveTab] = useState(getTabFromHash)

  useEffect(() => {
    const onHashChange = () => setActiveTab(getTabFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  function navigateTo(tab) {
    window.location.hash = tab
  }

  return (
    <div className="app">
      <div className="header">
        <h1>🌱 Lawncare Dashboard</h1>
        <p>Weather tracking & grass growth potential</p>
      </div>
      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'weather' ? 'active' : ''}`}
          onClick={() => navigateTo('weather')}
        >
          Weather & Growth
        </button>
        <button
          className={`tab-btn ${activeTab === 'predictions' ? 'active' : ''}`}
          onClick={() => navigateTo('predictions')}
        >
          Predictions
        </button>
        <button
          className={`tab-btn ${activeTab === 'dollarspot' ? 'active' : ''}`}
          onClick={() => navigateTo('dollarspot')}
        >
          Dollar Spot
        </button>
        <button
          className={`tab-btn ${activeTab === 'worklog' ? 'active' : ''}`}
          onClick={() => navigateTo('worklog')}
        >
          Work Log
        </button>
        <button
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => navigateTo('settings')}
        >
          Settings
        </button>
      </div>
      <ErrorBoundary key={activeTab}>
        {activeTab === 'weather' && <><WeatherChart /><GrowthPotentialChart /></>}
        {activeTab === 'predictions' && <Predictions />}
        {activeTab === 'dollarspot' && <DollarSpotChart />}
        {activeTab === 'worklog' && <WorkLog />}
        {activeTab === 'settings' && <Settings />}
      </ErrorBoundary>
    </div>
  )
}
