import { api } from '../api';
import { useEndpoint, useGrid } from '../state';
import {
  Badge, Card, ICONS, Legend, Loading, Metric, fmt,
} from '../components/ui';
import {
  BatteryIcon,
  DemandIcon,
  GridIcon,
  ShiftIcon,
  SolarIcon,
} from '../components/icons';
import { BeforeAfterChart, DispatchChart, SupplyDemandChart } from '../components/charts';

const TONE = {
  critical: 'var(--danger)',
  warning: 'var(--warn)',
  watch: 'var(--watch)',
  normal: 'var(--ok)',
};

export default function Dashboard() {
  const { sim } = useGrid();
  const { data, loading } = useEndpoint(api.dashboard);

  if (loading && !data) return <Loading what="community dashboard" />;
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
          Live position for <strong>{sim?.scenario?.label ?? 'the current scenario'}</strong> at {data.label},
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
          icon={<SolarIcon size={18} color="var(--solar)" />}
        />
        <Metric
          label="Neighbourhood demand"
          value={now.demandKw.toFixed(0)}
          unit="kW"
          foot={`${renewableCoverPct.toFixed(0)}% covered by local renewables`}
          tone="var(--demand)"
          icon={<DemandIcon size={18} color="var(--demand)" />}
        />
        <Metric
          label="Battery state"
          value={now.batterySocPct.toFixed(0)}
          unit="%"
          foot={now.batteryChargeKw > 1
            ? `Charging at ${fmt.kw(now.batteryChargeKw)}`
            : now.batteryDischargeKw > 1
              ? `Discharging at ${fmt.kw(now.batteryDischargeKw)}`
              : 'Holding charge'}
          tone="var(--battery)"
          fill={now.batterySocPct}
          icon={<BatteryIcon size={18} color="var(--battery)" />}
        />
        <Metric
          label="Grid import"
          value={now.gridImportKw.toFixed(0)}
          unit="kW"
          foot={now.headroomKw >= 0
            ? `${fmt.kw(now.headroomKw)} headroom under ${fmt.kw(now.importCapKw)} cap`
            : `${fmt.kw(-now.headroomKw)} over ${fmt.kw(now.importCapKw)} cap`}
          tone={now.headroomKw >= 0 ? 'var(--grid)' : 'var(--danger)'}
          icon={<GridIcon size={18} color={now.headroomKw >= 0 ? 'var(--grid)' : 'var(--danger)'} />}
        />
      </div>

      <div className="section-title">Reliability Executive Summary</div>
      <Card
        title={shortage.peakBeforeKw > 0
          ? `${fmt.kw(shortage.peakBeforeKw)} shortage forecast at ${shortage.worst?.label ?? ''}`
          : 'No shortage forecast'}
        sub={shortage.peakBeforeKw > 0
          ? `Grid import would exceed the sanctioned import cap. After optimisation the residual gap is ${fmt.kw(shortage.peakAfterKw)}.`
          : `Renewables and storage cover demand across the next ${data.forecast.length} hours.`}
        right={<Badge severity={severity}>{severity.toUpperCase()}</Badge>}
      >
        <div className="grid g3" style={{ marginBottom: 20 }}>
          <div className="rel-box danger">
            <div className="lbl">Without Action</div>
            <div className="val">{fmt.kw(shortage.peakBeforeKw)}</div>
          </div>
          <div className={`rel-box ${shortage.peakAfterKw > 0 ? 'warn' : 'success'}`}>
            <div className="lbl">With GridFlex</div>
            <div className="val">{fmt.kw(shortage.peakAfterKw)}</div>
          </div>
          <div className="rel-box success">
            <div className="lbl">Closed by the Plan</div>
            <div className="val">{fmt.kw(shortage.peakBeforeKw - shortage.peakAfterKw)}</div>
          </div>
        </div>

        <BeforeAfterChart baseline={data.baseline} optimised={data.optimised} height={260} />
        <Legend
          items={[
            { label: 'Do nothing (un-optimised)', color: '#ef4444' },
            { label: 'With GridFlex (optimised)', color: '#10b981' },
            { label: 'Sanctioned import cap', color: '#94a3b8' },
          ]}
        />
      </Card>

      <div className="section-title">Next 24 hours Horizon</div>
      <div className="grid g-2-1">
        <Card title="Forecast supply & demand" sub="Shaded band is demand uncertainty; red region marks evening peak window">
          <SupplyDemandChart data={data.forecast} />
          <Legend
            items={[
              { label: 'Solar', color: '#f59e0b' },
              { label: 'Wind', color: '#38bdf8' },
              { label: 'Demand', color: '#f97316' },
            ]}
          />
        </Card>

        <Card title="Recommended Actions" sub={data.applied ? 'Applied to live schedule' : 'Proposed - not yet committed'}>
          {actions.map((a) => (
            <div className="action" key={a.id}>
              <div className="pip">
                <ShiftIcon size={16} />
              </div>
              <div>
                <div className="title">{a.title}</div>
                <div className="detail">{a.detail}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>

      <div className="section-title">Hourly Energy Balance Under Plan</div>
      <Card sub="Stacked bars show energy source mix per hour; dashed line is the community import cap">
        <DispatchChart data={data.optimised} />
        <Legend
          items={[
            { label: 'Renewable', color: '#f59e0b' },
            { label: 'Battery', color: '#10b981' },
            { label: 'Grid', color: '#818cf8' },
            { label: 'Demand', color: '#f97316' },
            { label: 'Import cap', color: '#ef4444' },
          ]}
        />
      </Card>

      <div className="section-title">Impact Against Doing Nothing</div>
      <div className="grid g4">
        <Metric
          label="Peak reduction"
          value={impact.savings.peakReductionPct.toFixed(1)}
          unit="%"
          foot={`${fmt.kw(impact.savings.peakReductionKw)} off the peak`}
          tone="var(--watch)"
        />
        <Metric
          label="Cost saving"
          value={fmt.inr(impact.savings.costInr)}
          foot={`${impact.savings.costPct.toFixed(1)}% of today's energy bill`}
          tone="var(--ok)"
        />
        <Metric
          label="CO₂ avoided"
          value={impact.savings.co2AvoidedKg.toFixed(0)}
          unit="kg"
          foot={`${fmt.kwh(impact.savings.gridEnergyAvoidedKwh)} less grid energy`}
          tone="var(--battery)"
        />
        <Metric
          label="Shortage cleared"
          value={impact.savings.shortageClearedKwh.toFixed(0)}
          unit="kWh"
          foot={`Renewable utilisation ${fmt.pct(data.cases[2].renewableUtilisationPct)}`}
          tone={TONE.normal}
        />
      </div>
    </>
  );
}
