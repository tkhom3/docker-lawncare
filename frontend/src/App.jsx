import { useState } from 'react'
import WeatherChart from './components/WeatherChart'
import WorkLog from './components/WorkLog'
import DollarSpotChart from './components/DollarSpotChart'
import GrowthPotentialChart from './components/GrowthPotentialChart'
import Predictions from './components/Predictions'
import Settings from './components/Settings'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

export default function App() {
  const [activeTab, setActiveTab] = useState('weather')

  return (
    <div className="app">
      <div className="header">
        <h1>🌱 Lawncare Dashboard</h1>
        <p>Weather tracking & grass growth potential</p>
      </div>
      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'weather' ? 'active' : ''}`}
          onClick={() => setActiveTab('weather')}
        >
          Weather & Growth
        </button>
        <button
          className={`tab-btn ${activeTab === 'predictions' ? 'active' : ''}`}
          onClick={() => setActiveTab('predictions')}
        >
          Predictions
        </button>
        <button
          className={`tab-btn ${activeTab === 'dollarspot' ? 'active' : ''}`}
          onClick={() => setActiveTab('dollarspot')}
        >
          Dollar Spot
        </button>
        <button
          className={`tab-btn ${activeTab === 'worklog' ? 'active' : ''}`}
          onClick={() => setActiveTab('worklog')}
        >
          Work Log
        </button>
        <button
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
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
