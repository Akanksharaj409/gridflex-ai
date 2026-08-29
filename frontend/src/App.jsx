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
  CpuIcon,
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
  ZapIcon,
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
  { section: 'OVERVIEW' },
  { to: '/', label: 'Dashboard', end: true, icon: DashboardIcon },
  { section: 'ENERGY' },
  { to: '/forecast', label: 'Energy Forecast', icon: ForecastIcon },
  { to: '/battery', label: 'Battery Dispatch', icon: BatteryIcon },
  { to: '/demand-response', label: 'Demand Response', icon: DemandResponseIcon },
  { to: '/neighbourhood', label: 'Neighbourhood', icon: NeighbourhoodIcon },
  { section: 'INSIGHTS' },
  { to: '/alerts', label: 'Alerts', icon: AlertsIcon },
  { to: '/impact', label: 'Impact & Savings', icon: ImpactIcon },
  { section: 'UTILITY' },
  { to: '/discom', label: 'DISCOM Feeder View', icon: DiscomIcon },
  { to: '/assistant', label: 'AI Assistant', icon: AssistantIcon },
];

function TopBar({ onMobileNavToggle }) {
  const {
    sim, setScenario, setHour, advance, applyPlan, revertPlan,
    autoPlay, setAutoPlay, reset,
  } = useGrid();

  if (!sim) {
    return (
      <div className="topbar">
        <span className="faint">Connecting to GridFlex Engine...</span>
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

      <div className="sim-mode-badge" title="Simulated environment - live energy optimization engine">
        <CpuIcon size={14} color="var(--accent-grid)" />
        <span>SIMULATION MODE</span>
      </div>

      <div className="clock-badge" title="Simulated clock position">
        <div className="clock-icon">
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
          Revert Optimisation
        </button>
      ) : (
        <button className="btn primary" onClick={applyPlan}>
          <SparklesIcon size={16} />
          <span>APPLY OPTIMISATION</span>
        </button>
      )}

      <button className="btn ghost" onClick={reset} title="Reset scenario, clock & battery">
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
            <ZapIcon size={22} color="#ffffff" />
          </div>
          <div className="brand-title">
            <div className="name">
              GridFlex
            </div>
            <div className="tag">Energy Intelligence Platform</div>
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
          item.section ? (
            // eslint-disable-next-line react/no-array-index-key
            <div className="nav-section-title" key={idx}>{item.section}</div>
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
                  {isActive && <div className="active-glow-bar" />}
                  {item.icon && <item.icon size={18} />}
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          )
        ))}

        <div className="spacer" />

        {sim?.planApplied && (
          <div className="nav-status-footer">
            <CheckIcon size={16} color="var(--accent-battery)" />
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
