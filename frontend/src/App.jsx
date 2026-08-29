import { useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useGrid } from './state';
import { ErrorBanner } from './components/ui';
import {
  AlertsIcon,
  AssistantIcon,
  BatteryIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  DashboardIcon,
  DemandResponseIcon,
  DiscomIcon,
  ForecastIcon,
  ImpactIcon,
  MenuIcon,
  NeighbourhoodIcon,
  PauseIcon,
  PlayIcon,
  RefreshIcon,
  SparklesIcon,
} from './components/icons';

import Dashboard from './pages/Dashboard';
import Forecast from './pages/Forecast';
import Battery from './pages/Battery';
import DemandResponse from './pages/DemandResponse';
import Neighbourhood from './pages/Neighbourhood';
import Alerts from './pages/Alerts';
import Impact from './pages/Impact';
import Discom from './pages/Discom';
import Assistant from './pages/Assistant';

const NAV = [
  { group: 'Community' },
  { to: '/', label: 'Dashboard', end: true, icon: DashboardIcon },
  { to: '/forecast', label: 'Energy forecast', icon: ForecastIcon },
  { to: '/battery', label: 'Battery', icon: BatteryIcon },
  { to: '/demand-response', label: 'Demand response', icon: DemandResponseIcon },
  { to: '/neighbourhood', label: 'Neighbourhood', icon: NeighbourhoodIcon },
  { group: 'Outcomes' },
  { to: '/alerts', label: 'Alerts', icon: AlertsIcon },
  { to: '/impact', label: 'Impact & savings', icon: ImpactIcon },
  { group: 'Utility' },
  { to: '/discom', label: 'DISCOM feeder view', icon: DiscomIcon },
  { to: '/assistant', label: 'Assistant', icon: AssistantIcon },
];

function TopBar({ onMobileNavToggle }) {
  const {
    sim, setScenario, setHour, advance, applyPlan, revertPlan,
    autoPlay, setAutoPlay, reset,
  } = useGrid();

  if (!sim) {
    return (
      <div className="topbar">
        <span className="faint">Connecting to the API...</span>
      </div>
    );
  }

  return (
    <div className="topbar">
      <button
        className="mobile-nav-toggle"
        onClick={onMobileNavToggle}
        aria-label="Toggle navigation menu"
      >
        <MenuIcon size={20} />
      </button>

      <div className="clock-badge" title="Simulated Clock">
        <div className="clock-icon-wrapper">
          <ClockIcon size={18} />
        </div>
        <div className="clock-time">
          {sim.label}
          <small>simulated clock</small>
        </div>
      </div>

      <div className="hour-slider-container">
        <input
          type="range"
          min={0}
          max={23}
          value={sim.currentHour}
          onChange={(e) => setHour(Number(e.target.value))}
          aria-label="Simulated hour"
        />
        <span className="hour-slider-val">{String(sim.currentHour).padStart(2, '0')}:00</span>
        <button
          className="btn ghost"
          onClick={() => advance(1)}
          title="Advance one hour"
          style={{ padding: '4px 8px', fontSize: '12px' }}
        >
          +1h
        </button>
      </div>

      <select
        value={sim.scenarioId}
        onChange={(e) => setScenario(e.target.value)}
        aria-label="Scenario"
      >
        {sim.scenarios.map((s) => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>

      <button
        className={`btn ${autoPlay ? 'primary' : 'ghost'}`}
        onClick={() => setAutoPlay(!autoPlay)}
        title={autoPlay ? 'Pause simulation' : 'Play simulation'}
      >
        {autoPlay ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
        <span>{autoPlay ? 'Pause' : 'Play'}</span>
      </button>

      <div className="spacer" />

      {sim.planApplied ? (
        <button className="btn danger" onClick={revertPlan}>
          Revert optimisation
        </button>
      ) : (
        <button className="btn primary" onClick={applyPlan}>
          <SparklesIcon size={15} />
          <span>Apply optimisation</span>
        </button>
      )}

      <button className="btn ghost" onClick={reset} title="Reset scenario, clock and battery">
        <RefreshIcon size={15} />
      </button>
    </div>
  );
}

export default function App() {
  const { error, sim } = useGrid();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app">
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="brand">
          <div className="brand-icon">
            <SparklesIcon size={20} color="#ffffff" />
          </div>
          <div className="brand-title">
            <div className="name">
              GridFlex
            </div>
            <div className="tag">Energy Reliability Platform</div>
          </div>
          {mobileOpen && (
            <button
              style={{ marginLeft: 'auto', color: 'var(--text-dim)' }}
              onClick={() => setMobileOpen(false)}
            >
              <CloseIcon size={20} />
            </button>
          )}
        </div>

        {NAV.map((item, idx) => (
          item.group ? (
            // eslint-disable-next-line react/no-array-index-key
            <div className="nav-group" key={idx}>{item.group}</div>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              {({ isActive }) => (
                <>
                  {isActive && <div className="active-indicator" />}
                  {item.icon && <item.icon size={18} />}
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          )
        ))}

        <div className="spacer" />

        {sim?.planApplied && (
          <div className="nav-status-card">
            <CheckIcon size={16} color="var(--ok)" />
            <span>Optimisation Active</span>
          </div>
        )}
      </aside>

      <div className="main">
        <TopBar onMobileNavToggle={() => setMobileOpen(!mobileOpen)} />
        <div className="content">
          <ErrorBanner message={error} />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/forecast" element={<Forecast />} />
            <Route path="/battery" element={<Battery />} />
            <Route path="/demand-response" element={<DemandResponse />} />
            <Route path="/neighbourhood" element={<Neighbourhood />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/impact" element={<Impact />} />
            <Route path="/discom" element={<Discom />} />
            <Route path="/assistant" element={<Assistant />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
