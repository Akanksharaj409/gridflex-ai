import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useGrid } from './state';
import { ErrorBanner } from './components/ui';
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
  { to: '/', label: 'Dashboard', end: true },
  { to: '/forecast', label: 'Energy forecast' },
  { to: '/battery', label: 'Battery' },
  { to: '/demand-response', label: 'Demand response' },
  { to: '/neighbourhood', label: 'Neighbourhood' },
  { group: 'Outcomes' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/impact', label: 'Impact & savings' },
  { group: 'Utility' },
  { to: '/discom', label: 'DISCOM feeder view' },
  { to: '/assistant', label: 'Assistant' },
];

function TopBar() {
  const {
    sim, setScenario, setHour, advance, applyPlan, revertPlan,
    autoPlay, setAutoPlay, reset,
  } = useGrid();

  if (!sim) return <div className="topbar"><span className="faint">Connecting to the API...</span></div>;

  return (
    <div className="topbar">
      <div className="clock">
        {sim.label}
        <small>simulated clock</small>
      </div>

      <div className="hour-slider">
        <input
          type="range"
          min={0}
          max={23}
          value={sim.currentHour}
          onChange={(e) => setHour(Number(e.target.value))}
          aria-label="Simulated hour"
        />
        <button className="btn ghost" onClick={() => advance(1)} title="Advance one hour">+1h</button>
      </div>

      <select value={sim.scenarioId} onChange={(e) => setScenario(e.target.value)} aria-label="Scenario">
        {sim.scenarios.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>

      <button className={`btn ${autoPlay ? '' : 'ghost'}`} onClick={() => setAutoPlay(!autoPlay)}>
        {autoPlay ? 'Pause' : 'Play'}
      </button>

      <div className="spacer" />

      {sim.planApplied
        ? <button className="btn danger" onClick={revertPlan}>Revert optimisation</button>
        : <button className="btn primary" onClick={applyPlan}>Apply optimisation</button>}
      <button className="btn ghost" onClick={reset} title="Reset scenario, clock and battery">Reset</button>
    </div>
  );
}

export default function App() {
  const { error, sim } = useGrid();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="name">GridFlex</div>
          <div className="tag">Neighbourhood energy reliability</div>
        </div>
        {NAV.map((item) => (item.group
          ? <div className="nav-group" key={item.group}>{item.group}</div>
          : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="dot" />
              {item.label}
            </NavLink>
          )))}
        <div className="spacer" />
        {sim?.planApplied && (
          <div style={{ padding: '10px', fontSize: 11, color: 'var(--ok)' }}>
            Optimisation applied
          </div>
        )}
      </aside>

      <div className="main">
        <TopBar />
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
