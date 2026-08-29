import React from 'react';
import {
  AlertTriangleIcon,
  BatteryIcon,
  DemandIcon,
  GridIcon,
  ShieldCheckIcon,
  SolarIcon,
  WindIcon,
} from './icons';

/** Visual progress fill meter helper */
export function VisualProgressBar({ fillPct = 0, color = 'var(--accent-brand)', showText = true }) {
  const clamped = Math.max(0, Math.min(100, fillPct));
  const fillBars = Math.round((clamped / 100) * 14);
  const emptyBars = 14 - fillBars;
  const barString = '█'.repeat(fillBars) + '░'.repeat(emptyBars);

  return (
    <div className="visual-bar-meter" title={`${clamped.toFixed(0)}%`}>
      <div className="bar-fill-track">
        <div
          className="bar-fill-progress"
          style={{ width: `${clamped}%`, background: color }}
        />
      </div>
      {showText && (
        <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 11 }}>
          {clamped.toFixed(0)}%
        </span>
      )}
    </div>
  );
}

/** Dynamic Executive Grid Status Banner */
export function GridStatusBanner({ status = 'STABLE', peakShortageKw = 0, peakAfterKw = 0, peakTime = '' }) {
  const isCritical = peakShortageKw > 0;

  return (
    <div className={`grid-status-banner ${isCritical ? 'critical' : 'stable'}`}>
      <div className="row">
        <div className={`pulse-dot ${isCritical ? 'red' : 'green'}`} />
        <div>
          <div className="row" style={{ gap: 8 }}>
            <span style={{ fontSize: 11, fontVariant: 'all-small-caps', fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-faint)' }}>
              SYSTEM STATUS
            </span>
            <span style={{ fontWeight: 800, fontSize: 13, color: isCritical ? 'var(--accent-danger)' : 'var(--accent-battery)' }}>
              {isCritical ? 'CRITICAL SHORTAGE FORECAST' : 'GRID STABLE'}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 2 }}>
            {isCritical
              ? `Un-optimised demand will breach sanctioned cap by ${fmt.kw(peakShortageKw)} at ${peakTime}. Optimisation reduces gap to ${fmt.kw(peakAfterKw)}.`
              : 'Local renewables and storage fully satisfy demand across the forecast horizon under sanctioned import caps.'}
          </div>
        </div>
      </div>

      <div className="row" style={{ gap: 12 }}>
        {isCritical ? (
          <div className="badge critical" style={{ fontSize: 12, padding: '6px 12px' }}>
            <AlertTriangleIcon size={14} />
            <span>ACTION REQUIRED</span>
          </div>
        ) : (
          <div className="badge normal" style={{ fontSize: 12, padding: '6px 12px' }}>
            <ShieldCheckIcon size={14} />
            <span>OPTIMAL DISPATCH</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function Card({ title, sub, right, children, className = '', ...rest }) {
  return (
    <div className={`card ${className}`} {...rest}>
      {(title || right || sub) && (
        <div className="card-head">
          <div>
            {title && <h3>{title}</h3>}
            {sub && <div className="sub">{sub}</div>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Metric({ label, value, unit, foot, tone, fill, icon, isHero = false }) {
  let IconComponent = icon;
  if (!IconComponent) {
    const l = (label || '').toLowerCase();
    if (l.includes('renewable') || l.includes('solar')) IconComponent = <SolarIcon size={18} color={tone || 'var(--accent-solar)'} />;
    else if (l.includes('demand') || l.includes('load')) IconComponent = <DemandIcon size={18} color={tone || 'var(--accent-demand)'} />;
    else if (l.includes('battery') || l.includes('soc')) IconComponent = <BatteryIcon size={18} color={tone || 'var(--accent-battery)'} />;
    else if (l.includes('grid') || l.includes('import') || l.includes('feeder')) IconComponent = <GridIcon size={18} color={tone || 'var(--accent-grid)'} />;
    else if (l.includes('wind')) IconComponent = <WindIcon size={18} color={tone || 'var(--accent-wind)'} />;
  }

  if (isHero) {
    return (
      <div className="hero-metric-tile">
        <div className="metric-header">
          <span className="label" style={{ fontSize: 12 }}>{label}</span>
          {IconComponent && <div className="metric-icon-box">{IconComponent}</div>}
        </div>
        <div>
          <div className="hero-value">
            {value}
            {unit && <span style={{ fontSize: 18, color: 'var(--text-dim)', marginLeft: 4, fontFamily: 'var(--font-sans)', fontWeight: 500 }}>{unit}</span>}
          </div>
          {foot && <div className="foot" style={{ fontSize: 13 }}>{foot}</div>}
        </div>
        {fill != null && <VisualProgressBar fillPct={fill} color={tone || 'var(--accent-solar)'} />}
      </div>
    );
  }

  return (
    <div className="card metric">
      <div className="metric-header">
        <span className="label">{label}</span>
        {IconComponent && <div className="metric-icon-box">{IconComponent}</div>}
      </div>
      <div className="value" style={tone ? { color: tone } : undefined}>
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      {foot && <div className="foot">{foot}</div>}
      {fill != null && <VisualProgressBar fillPct={fill} color={tone || 'var(--accent-brand)'} />}
    </div>
  );
}

export function Badge({ severity = 'plain', children }) {
  return <span className={`badge ${severity}`}>{children}</span>;
}

export function StatRow({ k, v }) {
  return (
    <div className="stat-row">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

export function Loading({ what = 'data' }) {
  return (
    <div className="loading">
      <div className="spinner" />
      <span>Loading {what}...</span>
    </div>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="error-banner">
      <AlertTriangleIcon size={18} color="var(--accent-danger)" />
      <span>{message}</span>
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span className="legend-item" key={it.label}>
          <i style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

export const ICONS = {
  ev: '\u{1F697}',
  pump: '\u{1F4A7}',
  hvac: '\u{2744}',
  heater: '\u{1F525}',
  battery: '\u{1F50B}',
  shift: '\u{21C4}',
  curtail: '\u{2193}',
  grid: '\u{26A1}',
  hold: '\u{2713}',
};

export const fmt = {
  kw: (v) => `${Number(v ?? 0).toFixed(0)} kW`,
  kwh: (v) => `${Number(v ?? 0).toFixed(0)} kWh`,
  pct: (v) => `${Number(v ?? 0).toFixed(1)}%`,
  inr: (v) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`,
  kg: (v) => `${Number(v ?? 0).toFixed(0)} kg`,
};
