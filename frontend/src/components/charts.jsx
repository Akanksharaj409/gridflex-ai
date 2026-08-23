import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line,
  ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const AXIS = { stroke: '#5d6c7a', fontSize: 11, tickLine: false };
const GRID_STROKE = '#17222c';

function Tip({ active, payload, label, unit = 'kW' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="t">{label}</div>
      {payload
        .filter((p) => p.value != null && !p.name?.startsWith('_'))
        .map((p) => (
          <div className="r" key={p.dataKey}>
            <span style={{ color: p.color }}>{p.name}</span>
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
      fill="#f85149"
      fillOpacity={0.05}
      ifOverflow="hidden"
    />
  );
}

/** Generation vs demand, with the uncertainty band around the forecast. */
export function SupplyDemandChart({ data, height = 300, showBands = true }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -14 }}>
        <defs>
          <linearGradient id="gSolar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f5b301" stopOpacity={0.42} />
            <stop offset="100%" stopColor="#f5b301" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="label" {...AXIS} interval={2} />
        <YAxis {...AXIS} width={54} unit=" kW" />
        <Tooltip content={<Tip />} />
        <PeakBand data={data} />
        {showBands && (
          <Area type="monotone" dataKey="demandHighKw" name="_band" stroke="none" fill="#ff7a59" fillOpacity={0.09} />
        )}
        {showBands && (
          <Area type="monotone" dataKey="demandLowKw" name="_band" stroke="none" fill="#0b1015" fillOpacity={1} />
        )}
        <Area type="monotone" dataKey="predictedSolarKw" name="Solar" stroke="#f5b301" strokeWidth={2} fill="url(#gSolar)" />
        <Line type="monotone" dataKey="predictedWindKw" name="Wind" stroke="#4fc3f7" strokeWidth={1.6} dot={false} />
        <Line type="monotone" dataKey="predictedDemandKw" name="Demand" stroke="#ff7a59" strokeWidth={2.2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Where every kW comes from, hour by hour, under the optimised plan. */
export function DispatchChart({ data, capKey = 'capKw', height = 320 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -14 }} stackOffset="none">
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="label" {...AXIS} interval={2} />
        <YAxis {...AXIS} width={54} unit=" kW" />
        <Tooltip content={<Tip />} />
        <Bar dataKey="renewableKw" name="Renewable" stackId="s" fill="#f5b301" fillOpacity={0.85} />
        <Bar dataKey="batteryDischargeKw" name="Battery" stackId="s" fill="#7ee787" fillOpacity={0.85} />
        <Bar dataKey="gridImportKw" name="Grid" stackId="s" fill="#a78bfa" fillOpacity={0.7} />
        <Line type="stepAfter" dataKey={capKey} name="Import cap" stroke="#f85149" strokeWidth={1.6} strokeDasharray="4 3" dot={false} />
        <Line type="monotone" dataKey="demandKw" name="Demand" stroke="#ff7a59" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Battery state of charge against the reserve floor. */
export function SocChart({ data, reserveKwh, capacityKwh, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -14 }}>
        <defs>
          <linearGradient id="gSoc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7ee787" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#7ee787" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="label" {...AXIS} interval={2} />
        <YAxis {...AXIS} width={54} domain={[0, capacityKwh]} unit=" kWh" />
        <Tooltip content={<Tip unit="kWh" />} />
        <ReferenceLine y={reserveKwh} stroke="#f85149" strokeDasharray="4 3" strokeWidth={1.4} />
        <Area type="monotone" dataKey="socKwh" name="State of charge" stroke="#7ee787" strokeWidth={2} fill="url(#gSoc)" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Charge and discharge power, signed so the two directions read at a glance. */
export function ChargeChart({ data, height = 200 }) {
  const signed = data.map((d) => ({ ...d, chargeKw: d.chargeKw ?? d.batteryChargeKw ?? 0, dischargeKw: -(d.dischargeKw ?? d.batteryDischargeKw ?? 0) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={signed} margin={{ top: 6, right: 8, bottom: 0, left: -14 }}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="label" {...AXIS} interval={2} />
        <YAxis {...AXIS} width={54} unit=" kW" />
        <Tooltip content={<Tip />} />
        <ReferenceLine y={0} stroke="#2b3d4d" />
        <Bar dataKey="chargeKw" name="Charging" fill="#4fc3f7" radius={[2, 2, 0, 0]} />
        <Bar dataKey="dischargeKw" name="Discharging" fill="#7ee787" radius={[0, 0, 2, 2]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Baseline vs optimised grid import - the money chart for the demo. */
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
      <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -14 }}>
        <defs>
          <linearGradient id="gBefore" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f85149" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#f85149" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="label" {...AXIS} interval={2} />
        <YAxis {...AXIS} width={54} unit=" kW" />
        <Tooltip content={<Tip />} />
        <PeakBand data={data} />
        <Area type="monotone" dataKey="beforeKw" name="Do nothing" stroke="#f85149" strokeWidth={1.8} fill="url(#gBefore)" />
        <Line type="monotone" dataKey="afterKw" name="With GridFlex" stroke="#3fb950" strokeWidth={2.4} dot={false} />
        <Line type="stepAfter" dataKey="capKw" name="Import cap" stroke="#8b9bab" strokeWidth={1.4} strokeDasharray="4 3" dot={false} />
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
      <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -14 }}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="label" {...AXIS} interval={2} />
        <YAxis {...AXIS} width={54} unit=" kW" />
        <Tooltip content={<Tip />} />
        <Bar dataKey="beforeKw" name="Before" fill="#f85149" fillOpacity={0.55} radius={[2, 2, 0, 0]} />
        <Bar dataKey="afterKw" name="After" fill="#3fb950" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
