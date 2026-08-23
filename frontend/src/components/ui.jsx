export function Card({ title, sub, right, children, className = '', ...rest }) {
  return (
    <div className={`card ${className}`} {...rest}>
      {(title || right) && (
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

export function Metric({ label, value, unit, foot, tone, fill }) {
  return (
    <div className="card metric">
      <div className="label">{label}</div>
      <div className="value" style={tone ? { color: tone } : undefined}>
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      {foot && <div className="foot">{foot}</div>}
      {fill != null && (
        <div className="bar">
          <span style={{ width: `${Math.max(0, Math.min(100, fill))}%`, background: tone ?? 'var(--watch)' }} />
        </div>
      )}
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
  return <div className="loading">Loading {what}...</div>;
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return <div className="error-banner">{message}</div>;
}

export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.label}>
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
