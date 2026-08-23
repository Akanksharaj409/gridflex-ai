import { api } from '../api';
import { useEndpoint, useGrid } from '../state';
import {
  Badge, Card, ICONS, Legend, Loading, Metric, fmt,
} from '../components/ui';
import { BeforeAfterChart, DispatchChart, SupplyDemandChart } from '../components/charts';

const TONE = {
  critical: 'var(--danger)', warning: 'var(--warn)', watch: 'var(--watch)', normal: 'var(--ok)',
};

export default function Dashboard() {
  const { sim } = useGrid();
  const { data, loading } = useEndpoint(api.dashboard);

  if (loading && !data) return <Loading what="dashboard" />;
  if (!data) return null;

  const { now, shortage, impact, actions } = data;
  const severity = shortage.peakBeforeKw > 0
    ? (shortage.worst?.severity ?? 'warning')
    : 'normal';
  const renewableCoverPct = now.demandKw > 0
    ? Math.min(100, (now.renewableKw / now.demandKw) * 100)
    : 100;

  return (
    <>
      <div className="page-head">
        <h2>Community dashboard</h2>
        <p>
          Live position for {sim?.scenario?.label?.toLowerCase() ?? 'the current scenario'} at {data.label},
          with the next {data.forecast.length} hours forecast and the optimiser&apos;s recommended actions.
        </p>
      </div>

      <div className="grid g4">
        <Metric
          label="Renewable generation"
          value={now.renewableKw.toFixed(0)}
          unit="kW"
          foot={`Solar ${fmt.kw(now.solarKw)} · wind ${fmt.kw(now.windKw)}`}
          tone="var(--solar)"
          fill={renewableCoverPct}
        />
        <Metric
          label="Neighbourhood demand"
          value={now.demandKw.toFixed(0)}
          unit="kW"
          foot={`${renewableCoverPct.toFixed(0)}% covered by local renewables`}
          tone="var(--demand)"
        />
        <Metric
          label="Battery"
          value={now.batterySocPct.toFixed(0)}
          unit="%"
          foot={now.batteryChargeKw > 1
            ? `Charging at ${fmt.kw(now.batteryChargeKw)}`
            : now.batteryDischargeKw > 1
              ? `Discharging at ${fmt.kw(now.batteryDischargeKw)}`
              : 'Holding charge'}
          tone="var(--battery)"
          fill={now.batterySocPct}
        />
        <Metric
          label="Grid import"
          value={now.gridImportKw.toFixed(0)}
          unit="kW"
          foot={now.headroomKw >= 0
            ? `${fmt.kw(now.headroomKw)} headroom under the ${fmt.kw(now.importCapKw)} cap`
            : `${fmt.kw(-now.headroomKw)} over the ${fmt.kw(now.importCapKw)} cap`}
          tone={now.headroomKw >= 0 ? 'var(--grid)' : 'var(--danger)'}
        />
      </div>

      <div className="section-title">Reliability</div>
      <Card
        title={shortage.peakBeforeKw > 0
          ? `${fmt.kw(shortage.peakBeforeKw)} shortage forecast at ${shortage.worst?.label ?? ''}`
          : 'No shortage forecast'}
        sub={shortage.peakBeforeKw > 0
          ? `Grid import would exceed the sanctioned import cap. After optimisation the residual gap is ${fmt.kw(shortage.peakAfterKw)}.`
          : `Renewables and storage cover demand across the next ${data.forecast.length} hours.`}
        right={<Badge severity={severity}>{severity}</Badge>}
      >
        <div className="grid g3" style={{ marginBottom: 16 }}>
          <div>
            <div className="faint" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Without action</div>
            <div className="mono" style={{ fontSize: 22, color: 'var(--danger)' }}>{fmt.kw(shortage.peakBeforeKw)}</div>
          </div>
          <div>
            <div className="faint" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>With GridFlex</div>
            <div className="mono" style={{ fontSize: 22, color: shortage.peakAfterKw > 0 ? 'var(--warn)' : 'var(--ok)' }}>
              {fmt.kw(shortage.peakAfterKw)}
            </div>
          </div>
          <div>
            <div className="faint" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Closed by the plan</div>
            <div className="mono" style={{ fontSize: 22, color: 'var(--ok)' }}>
              {fmt.kw(shortage.peakBeforeKw - shortage.peakAfterKw)}
            </div>
          </div>
        </div>
        <BeforeAfterChart baseline={data.baseline} optimised={data.optimised} height={240} />
        <Legend
          items={[
            { label: 'Do nothing', color: '#f85149' },
            { label: 'With GridFlex', color: '#3fb950' },
            { label: 'Import cap', color: '#8b9bab' },
          ]}
        />
      </Card>

      <div className="section-title">Next 24 hours</div>
      <div className="grid g-2-1">
        <Card title="Forecast supply and demand" sub="Shaded band is the demand forecast uncertainty; red band marks the constrained evening window">
          <SupplyDemandChart data={data.forecast} />
          <Legend
            items={[
              { label: 'Solar', color: '#f5b301' },
              { label: 'Wind', color: '#4fc3f7' },
              { label: 'Demand', color: '#ff7a59' },
            ]}
          />
        </Card>

        <Card title="Recommended actions" sub={data.applied ? 'Applied to the live schedule' : 'Not yet applied'}>
          {actions.map((a) => (
            <div className="action" key={a.id}>
              <div className="pip">{ICONS[a.type] ?? ICONS.grid}</div>
              <div>
                <div className="title">{a.title}</div>
                <div className="detail">{a.detail}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>

      <div className="section-title">Hourly energy balance under the plan</div>
      <Card sub="Stacked bars show where each kW is served from; the dashed line is the import cap the community must stay under">
        <DispatchChart data={data.optimised} />
        <Legend
          items={[
            { label: 'Renewable', color: '#f5b301' },
            { label: 'Battery', color: '#7ee787' },
            { label: 'Grid', color: '#a78bfa' },
            { label: 'Demand', color: '#ff7a59' },
            { label: 'Import cap', color: '#f85149' },
          ]}
        />
      </Card>

      <div className="section-title">Impact against doing nothing</div>
      <div className="grid g4">
        <Metric label="Peak reduction" value={impact.savings.peakReductionPct.toFixed(1)} unit="%" foot={`${fmt.kw(impact.savings.peakReductionKw)} off the peak`} tone="var(--watch)" />
        <Metric label="Cost saving" value={fmt.inr(impact.savings.costInr)} foot={`${impact.savings.costPct.toFixed(1)}% of today's energy bill`} tone="var(--ok)" />
        <Metric label="CO₂ avoided" value={impact.savings.co2AvoidedKg.toFixed(0)} unit="kg" foot={`${fmt.kwh(impact.savings.gridEnergyAvoidedKwh)} less grid energy`} tone="var(--battery)" />
        <Metric label="Shortage cleared" value={impact.savings.shortageClearedKwh.toFixed(0)} unit="kWh" foot={`Renewable utilisation ${fmt.pct(data.cases[2].renewableUtilisationPct)}`} tone={TONE.normal} />
      </div>
    </>
  );
}
