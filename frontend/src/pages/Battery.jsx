import { api } from '../api';
import { useEndpoint, useGrid } from '../state';
import { Badge, Card, Legend, Loading, Metric, StatRow, fmt } from '../components/ui';
import { BatteryIcon } from '../components/icons';
import { ChargeChart, SocChart } from '../components/charts';

const MODE_TONE = { charging: 'watch', discharging: 'normal', idle: 'plain' };

export default function Battery() {
  const { setBatterySoc } = useGrid();
  const { data, loading } = useEndpoint(api.battery);

  if (loading && !data) return <Loading what="battery state" />;
  if (!data) return null;

  const { config, live, summary, schedule } = data;
  const active = schedule.filter((s) => s.mode !== 'idle');

  return (
    <>
      <div className="page-head">
        <h2>Community Battery Storage</h2>
        <p>
          {config.capacityKwh} kWh shared storage, dispatched by value rather than chronologically: it charges from
          any surplus, then spends that energy on the hours where the tariff and the import cap make it worth the
          most. A {config.minReservePct}% reserve is never crossed.
        </p>
      </div>

      <div className="grid g4">
        <Metric
          label="State of Charge"
          value={live.socPct.toFixed(0)}
          unit="%"
          foot={`${fmt.kwh(live.socKwh)} of ${fmt.kwh(config.capacityKwh)}`}
          tone="var(--accent-battery)"
          fill={live.socPct}
          icon={<BatteryIcon size={18} color="var(--accent-battery)" />}
        />
        <Metric
          label="Usable Reserve"
          value={live.usableKwh.toFixed(0)}
          unit="kWh"
          foot={`Above ${fmt.kwh(live.reserveKwh)} reserve floor`}
          tone="var(--accent-brand)"
        />
        <Metric
          label="Planned Throughput"
          value={summary.chargedKwh.toFixed(0)}
          unit="kWh in"
          foot={`${fmt.kwh(summary.dischargedKwh)} out · ${summary.equivalentCycles} cycles`}
          tone="var(--accent-solar)"
        />
        <Metric
          label="Power Limits"
          value={config.maxChargeKw}
          unit="kW"
          foot={`Charge & discharge · ${(config.roundTripEfficiency * 100).toFixed(0)}% efficiency`}
          tone="var(--accent-grid)"
        />
      </div>

      <div className="section-title">Planned State of Charge</div>
      <Card sub="Red dashed line is reserve floor dispatcher will not cross">
        <SocChart data={schedule} reserveKwh={live.reserveKwh} capacityKwh={config.capacityKwh} />
      </Card>

      <div className="section-title">Charge &amp; Discharge Dispatch Schedule</div>
      <div className="asymmetric-2-1">
        <Card sub="Positive is charging from surplus, negative is discharging into demand">
          <ChargeChart data={schedule} height={240} />
          <Legend items={[{ label: 'Charging', color: '#38bdf8' }, { label: 'Discharging', color: '#10b981' }]} />
        </Card>

        <div className="grid" style={{ alignContent: 'start' }}>
          <Card title="Dispatch Summary">
            <StatRow k="Start of horizon" v={`${summary.startSocPct}%`} />
            <StatRow k="End of horizon" v={`${summary.endSocPct}%`} />
            <StatRow k="Energy charged" v={fmt.kwh(summary.chargedKwh)} />
            <StatRow k="Energy discharged" v={fmt.kwh(summary.dischargedKwh)} />
            <StatRow k="Surplus curtailed" v={fmt.kwh(summary.curtailedKwh)} />
            <StatRow k="Reserve floor" v={fmt.kwh(summary.reserveKwh)} />
          </Card>

          <Card title="Set State of Charge" sub="Drag to test how the plan changes with more or less stored energy">
            <div style={{ marginTop: 10 }}>
              <input
                type="range"
                min={config.minReservePct}
                max={100}
                value={live.socPct}
                onChange={(e) => setBatterySoc(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-battery)', cursor: 'pointer' }}
              />
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 12, marginTop: 6 }}>
                <span className="faint">{config.minReservePct}% reserve</span>
                <span className="mono" style={{ fontWeight: 700, color: 'var(--accent-battery)' }}>{live.socPct}%</span>
                <span className="faint">100%</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="section-title">Hour by Hour Breakdown</div>
      <Card className="pad-0">
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Hour</th>
                <th>Mode</th>
                <th className="num">Charge</th>
                <th className="num">Discharge</th>
                <th className="num">State of Charge</th>
                <th className="num">%</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((s) => (
                <tr key={s.hour + '-' + s.socKwh}>
                  <td className="mono">{s.label}</td>
                  <td><Badge severity={MODE_TONE[s.mode]}>{s.mode}</Badge></td>
                  <td className="num">{s.chargeKw > 0 ? s.chargeKw.toFixed(0) : '—'}</td>
                  <td className="num">{s.dischargeKw > 0 ? s.dischargeKw.toFixed(0) : '—'}</td>
                  <td className="num">{s.socKwh.toFixed(0)}</td>
                  <td className="num">{s.socPct.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {active.length === 0 && (
        <p className="faint" style={{ fontSize: 12, marginTop: 12 }}>
          The battery is idle across this horizon — there is no surplus to store and no hour where stored energy
          beats grid energy.
        </p>
      )}
    </>
  );
}
