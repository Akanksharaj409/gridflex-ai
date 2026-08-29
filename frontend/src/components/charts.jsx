import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line,
  ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const AXIS = { stroke: '#64748b', fontSize: 11, tickLine: false, axisLine: false };
const GRID_STROKE = '#142137';

function Tip({ active, payload, label, unit = 'kW' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="t">{label}</div>
      {payload
        .filter((p) => p.value != null && !p.name?.startsWith('_'))
        .map((p) => (
          <div className="r" key={p.dataKey || p.name}>
            <span style={{ color: p.color, fontWeight: 600 }}>{p.name}</span>
            <span>{Number(p.value).toFixed(1)} {unit}</span>
          </div>
        ))}
    </div>
  );
}

/** Evening peak window shading, so the constrained hours are obvious. */
function PeakBand({ data, peakHours = [18, 19, 20, 21] }) {
  const inWindow = data.filter((d) => peakHours.includes(d.hour));
  if (inWindow.length < 2) return null;
  return (
    <ReferenceArea
      x1={inWindow[0].label}
      x2={inWindow[inWindow.length - 1].label}
      fill="#ef4444"
      fillOpacity={0.08}
      ifOverflow="hidden"
    />
  );
}

/** Generation vs demand, with the uncertainty band around the forecast. */
export function SupplyDemandChart({ data, height = 320, showBands = true }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -14 }}>
        <defs>
          <linearGradient id="gSolar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" {...AXIS} interval={2} />
        <YAxis {...AXIS} width={54} unit=" kW" />
        <Tooltip content={<Tip />} />
        <PeakBand data={data} />
        {showBands && (
          <Area type="monotone" dataKey="demandHighKw" name="_band" stroke="none" fill="#f97316" fillOpacity={0.08} />
        )}
        {showBands && (
          <Area type="monotone" dataKey="demandLowKw" name="_band" stroke="none" fill="#05080e" fillOpacity={1} />
        )}
        <Area type="monotone" dataKey="predictedSolarKw" name="Solar" stroke="#f59e0b" strokeWidth={2.4} fill="url(#gSolar)" />
        <Line type="monotone" dataKey="predictedWindKw" name="Wind" stroke="#38bdf8" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="predictedDemandKw" name="Demand" stroke="#f97316" strokeWidth={2.6} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Where every kW comes from, hour by hour, under the optimised plan. */
export function DispatchChart({ data, capKey = 'capKw', height = 320 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -14 }} stackOffset="none">
        <CartesianGrid stroke={GRID_STROKE} vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" {...AXIS} interval={2} />
        <YAxis {...AXIS} width={54} unit=" kW" />
        <Tooltip content={<Tip />} />
        <Bar dataKey="renewableKw" name="Renewable" stackId="s" fill="#f59e0b" fillOpacity={0.9} radius={[0, 0, 0, 0]} />
        <Bar dataKey="batteryDischargeKw" name="Battery" stackId="s" fill="#10b981" fillOpacity={0.9} radius={[0, 0, 0, 0]} />
        <Bar dataKey="gridImportKw" name="Grid" stackId="s" fill="#06b6d4" fillOpacity={0.75} radius={[2, 2, 0, 0]} />
        <Line type="stepAfter" dataKey={capKey} name="Import cap" stroke="#ef4444" strokeWidth={2} strokeDasharray="4 3" dot={false} />
        <Line type="monotone" dataKey="demandKw" name="Demand" stroke="#f97316" strokeWidth={2.4} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Battery state of charge against the reserve floor. */
export function SocChart({ data, reserveKwh, capacityKwh, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -14 }}>
        <defs>
          <linearGradient id="gSoc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" {...AXIS} interval={2} />
        <YAxis {...AXIS} width={54} domain={[0, capacityKwh]} unit=" kWh" />
        <Tooltip content={<Tip unit="kWh" />} />
        <ReferenceLine y={reserveKwh} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1.8} />
        <Area type="monotone" dataKey="socKwh" name="State of charge" stroke="#10b981" strokeWidth={2.4} fill="url(#gSoc)" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Charge and discharge power, signed so the two directions read at a glance. */
export function ChargeChart({ data, height = 220 }) {
  const signed = data.map((d) => ({
    ...d,
    chargeKw: d.chargeKw ?? d.batteryChargeKw ?? 0,
    dischargeKw: -(d.dischargeKw ?? d.batteryDischargeKw ?? 0),
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={signed} margin={{ top: 10, right: 10, bottom: 0, left: -14 }}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" {...AXIS} interval={2} />
        <YAxis {...AXIS} width={54} unit=" kW" />
        <Tooltip content={<Tip />} />
        <ReferenceLine y={0} stroke="#2c4268" />
        <Bar dataKey="chargeKw" name="Charging" fill="#38bdf8" radius={[3, 3, 0, 0]} />
        <Bar dataKey="dischargeKw" name="Discharging" fill="#10b981" radius={[0, 0, 3, 3]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Baseline vs optimised grid import - High Impact "Why GridFlex?" Chart. */
export function BeforeAfterChart({ baseline, optimised, height = 300 }) {
  const data = baseline.map((b, i) => ({
    label: b.label,
    hour: b.hour,
    beforeKw: b.gridImportKw,
    afterKw: optimised[i]?.gridImportKw ?? null,
    capKw: b.capKw ?? optimised[i]?.capKw,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -14 }}>
        <defs>
          <linearGradient id="gBefore" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" {...AXIS} interval={2} />
        <YAxis {...AXIS} width={54} unit=" kW" />
        <Tooltip content={<Tip />} />
        <PeakBand data={data} />
        <Area type="monotone" dataKey="beforeKw" name="Do nothing (Un-optimised)" stroke="#ef4444" strokeWidth={2.2} fill="url(#gBefore)" />
        <Line type="monotone" dataKey="afterKw" name="With GridFlex (Optimised)" stroke="#22c55e" strokeWidth={2.8} dot={false} />
        <Line type="stepAfter" dataKey="capKw" name="Sanctioned Import Cap" stroke="#06b6d4" strokeWidth={1.8} strokeDasharray="4 3" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Shortage magnitude per hour, before and after. */
export function ShortageChart({ before, after, height = 220 }) {
  const data = before.map((b, i) => ({
    label: b.label,
    hour: b.hour,
    beforeKw: b.shortageKw,
    afterKw: after[i]?.shortageKw ?? 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -14 }}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" {...AXIS} interval={2} />
        <YAxis {...AXIS} width={54} unit=" kW" />
        <Tooltip content={<Tip />} />
        <Bar dataKey="beforeKw" name="Before Plan" fill="#ef4444" fillOpacity={0.65} radius={[3, 3, 0, 0]} />
        <Bar dataKey="afterKw" name="After Plan" fill="#22c55e" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
