import { api } from '../api';
import { useEndpoint } from '../state';
import { Card, Loading, Metric, StatRow, fmt } from '../components/ui';
import { BatteryIcon, ImpactIcon } from '../components/icons';
import { BeforeAfterChart } from '../components/charts';

const ROWS = [
  { key: 'costInr', label: 'Energy cost', format: fmt.inr, lowerIsBetter: true },
  { key: 'peakGridImportKw', label: 'Peak grid import', format: fmt.kw, lowerIsBetter: true },
  { key: 'gridImportKwh', label: 'Grid energy', format: fmt.kwh, lowerIsBetter: true },
  { key: 'shortageKwh', label: 'Unserved above import cap', format: fmt.kwh, lowerIsBetter: true },
  { key: 'co2Kg', label: 'CO₂ emitted', format: fmt.kg, lowerIsBetter: true },
  { key: 'renewableUtilisationPct', label: 'Renewable utilisation', format: fmt.pct, lowerIsBetter: false },
  { key: 'curtailedKwh', label: 'Renewable curtailed', format: fmt.kwh, lowerIsBetter: true },
  { key: 'servedByBatteryKwh', label: 'Served by battery', format: fmt.kwh, lowerIsBetter: false },
];

export default function Impact() {
  const { data, loading } = useEndpoint(api.impact);
  const { data: dash } = useEndpoint(api.dashboard);

  if (loading && !data) return <Loading what="impact analytics" />;
  if (!data) return null;

  const [doNothing, batteryOnly, full] = data.cases;
  const s = data.impact.savings;

  return (
    <>
      <div className="page-head">
        <h2>Impact &amp; Savings</h2>
        <p>
          Everything is measured against a do-nothing baseline over the same 24-hour horizon and the same weather:
          no load shifted, battery idle, every deficit met from the grid. Battery-only is reported separately so
          storage and demand response are not credited with the same kilowatt-hour twice.
        </p>
      </div>

      <div className="grid g4">
        <Metric
          label="Peak reduction"
          value={s.peakReductionPct.toFixed(1)}
          unit="%"
          foot={`${fmt.kw(s.peakReductionKw)} off daily peak`}
          tone="var(--watch)"
          icon={<ImpactIcon size={18} color="var(--watch)" />}
        />
        <Metric
          label="Cost saving"
          value={fmt.inr(s.costInr)}
          foot={`${s.costPct.toFixed(1)}% of today's energy bill`}
          tone="var(--ok)"
        />
        <Metric
          label="CO₂ avoided"
          value={s.co2AvoidedKg.toFixed(0)}
          unit="kg"
          foot={`${s.co2AvoidedPct.toFixed(1)}% lower emissions`}
          tone="var(--battery)"
          icon={<BatteryIcon size={18} color="var(--battery)" />}
        />
        <Metric
          label="Shortage cleared"
          value={s.shortageClearedKwh.toFixed(0)}
          unit="kWh"
          foot="Demand exceeding import cap cleared"
          tone="var(--solar)"
        />
      </div>

      {dash && (
        <>
          <div className="section-title">Grid Import: Before vs After</div>
          <Card sub="The area is what the community would have drawn; the green line is what it draws under the plan">
            <BeforeAfterChart baseline={dash.baseline} optimised={dash.optimised} height={280} />
          </Card>
        </>
      )}

      <div className="section-title">Three Scenario Cases Side-by-Side</div>
      <Card className="pad-0">
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th className="num">{doNothing.label}</th>
              <th className="num">{batteryOnly.label}</th>
              <th className="num">{full.label}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => {
              const a = doNothing[r.key];
              const c = full[r.key];
              const better = r.lowerIsBetter ? c < a : c > a;
              return (
                <tr key={r.key}>
                  <td style={{ fontWeight: 500 }}>{r.label}</td>
                  <td className="num faint">{r.format(a)}</td>
                  <td className="num muted">{r.format(batteryOnly[r.key])}</td>
                  <td className="num" style={{ color: better ? 'var(--ok)' : undefined, fontWeight: better ? 600 : 400 }}>
                    {r.format(c)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="section-title">Annual Projections &amp; Battery Contribution</div>
      <div className="grid g-2-1">
        <Card title="If today repeated for a year" sub="A straight multiplication, not a seasonal model — order of magnitude indicator">
          <div className="grid g3" style={{ marginTop: 12 }}>
            <Metric label="Annual saving" value={fmt.inr(data.annual.costInr)} foot="At today's tariff" tone="var(--ok)" />
            <Metric label="Annual CO₂ avoided" value={(data.annual.co2Kg / 1000).toFixed(1)} unit="t" foot={`${data.annual.co2Kg.toLocaleString('en-IN')} kg`} tone="var(--battery)" />
            <Metric label="Equivalent trees" value={data.annual.treesEquivalent.toLocaleString('en-IN')} foot="At ~21 kg CO₂ / tree / yr" tone="var(--solar)" />
          </div>
        </Card>

        <Card title="Battery contribution">
          <StatRow k="Charged" v={fmt.kwh(data.battery.chargedKwh)} />
          <StatRow k="Discharged" v={fmt.kwh(data.battery.dischargedKwh)} />
          <StatRow k="Equivalent cycles" v={data.battery.equivalentCycles} />
          <StatRow k="Curtailed surplus" v={fmt.kwh(data.battery.curtailedKwh)} />
          <StatRow k="End of horizon" v={`${data.battery.endSocPct}%`} />
        </Card>
      </div>

      <div className="section-title">Methodology &amp; Calculation</div>
      <Card>
        <StatRow k="Baseline" v="" />
        <p className="muted" style={{ fontSize: 13, margin: '4px 0 14px', lineHeight: 1.5 }}>{data.method.baseline}</p>
        <StatRow k="Optimised" v="" />
        <p className="muted" style={{ fontSize: 13, margin: '4px 0 14px', lineHeight: 1.5 }}>{data.method.optimised}</p>
        <p className="faint" style={{ fontSize: 12, margin: 0 }}>{data.method.note}</p>
      </Card>
    </>
  );
}
