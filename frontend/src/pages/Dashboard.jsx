import { api } from '../api';
import { useEndpoint, useGrid } from '../state';
import {
  Badge, Card, GridStatusBanner, ICONS, Legend, Loading, Metric, fmt,
} from '../components/ui';
import {
  ArrowRightIcon,
  BatteryIcon,
  DemandIcon,
  GridIcon,
  ShiftIcon,
  SolarIcon,
  ZapIcon,
} from '../components/icons';
import { EnergyFlowVisual } from '../components/EnergyFlowVisual';
import { BeforeAfterChart, DispatchChart, SupplyDemandChart } from '../components/charts';

const TONE = {
  critical: 'var(--accent-danger)',
  warning: 'var(--accent-warn)',
  watch: 'var(--accent-brand)',
  normal: 'var(--accent-battery)',
};

export default function Dashboard() {
  const { sim } = useGrid();
  const { data, loading } = useEndpoint(api.dashboard);

  if (loading && !data) return <Loading what="energy intelligence dashboard" />;
  if (!data) return null;

  const { now, shortage, impact, actions } = data;
  const severity = shortage.peakBeforeKw > 0
    ? (shortage.worst?.severity ?? 'warning')
    : 'normal';
  const renewableCoverPct = now.demandKw > 0
    ? Math.min(100, (now.renewableKw / now.demandKw) * 100)
    : 100;

  const shortageAvoidedKw = shortage.peakBeforeKw - shortage.peakAfterKw;
  const percentageAvoided = shortage.peakBeforeKw > 0
    ? ((shortageAvoidedKw / shortage.peakBeforeKw) * 100).toFixed(1)
    : '100';

  return (
    <>
      {/* 1. Dynamic Grid Status Banner */}
      <GridStatusBanner
        status={shortage.peakBeforeKw > 0 ? 'CRITICAL SHORTAGE FORECAST' : 'STABLE'}
        peakShortageKw={shortage.peakBeforeKw}
        peakAfterKw={shortage.peakAfterKw}
        peakTime={shortage.worst?.label ?? ''}
      />

      <div className="page-head">
        <h2>Energy Reliability Overview</h2>
        <p>
          Live grid telemetry for <strong>{sim?.scenario?.label ?? 'Current Scenario'}</strong> at {data.label},
          forecasting the next {data.forecast.length} hours and real-time battery &amp; demand dispatch.
        </p>
      </div>

      {/* 2. Asymmetrical Hero Layout: Hero Renewable Card + Live Energy Flow Visual */}
      <div className="hero-grid">
        <Metric
          isHero
          label="Total Renewable Generation"
          value={now.renewableKw.toFixed(0)}
          unit="kW"
          foot={`Solar ${fmt.kw(now.solarKw)} · Wind ${fmt.kw(now.windKw)}`}
          tone="var(--accent-solar)"
          fill={renewableCoverPct}
          icon={<SolarIcon size={24} color="var(--accent-solar)" />}
        />

        <EnergyFlowVisual
          solarKw={now.solarKw}
          windKw={now.windKw}
          renewableKw={now.renewableKw}
          demandKw={now.demandKw}
          batteryChargeKw={now.batteryChargeKw}
          batteryDischargeKw={now.batteryDischargeKw}
          gridImportKw={now.gridImportKw}
          batterySocPct={now.batterySocPct}
        />
      </div>

      {/* 3. Supporting Key Metrics */}
      <div className="grid g3" style={{ marginBottom: 28 }}>
        <Metric
          label="Neighbourhood Demand"
          value={now.demandKw.toFixed(0)}
          unit="kW"
          foot={`${renewableCoverPct.toFixed(0)}% covered by local renewables`}
          tone="var(--accent-demand)"
          icon={<DemandIcon size={18} color="var(--accent-demand)" />}
        />
        <Metric
          label="Community Battery"
          value={now.batterySocPct.toFixed(0)}
          unit="%"
          foot={now.batteryChargeKw > 1
            ? `Charging at ${fmt.kw(now.batteryChargeKw)}`
            : now.batteryDischargeKw > 1
              ? `Discharging at ${fmt.kw(now.batteryDischargeKw)}`
              : 'Holding charge / Standby'}
          tone="var(--accent-battery)"
          fill={now.batterySocPct}
          icon={<BatteryIcon size={18} color="var(--accent-battery)" />}
        />
        <Metric
          label="Grid Substation Import"
          value={now.gridImportKw.toFixed(0)}
          unit="kW"
          foot={now.headroomKw >= 0
            ? `${fmt.kw(now.headroomKw)} headroom under ${fmt.kw(now.importCapKw)} cap`
            : `${fmt.kw(-now.headroomKw)} over ${fmt.kw(now.importCapKw)} cap`}
          tone={now.headroomKw >= 0 ? 'var(--accent-grid)' : 'var(--accent-danger)'}
          fill={now.importCapKw > 0 ? (now.gridImportKw / now.importCapKw) * 100 : 0}
          icon={<GridIcon size={18} color={now.headroomKw >= 0 ? 'var(--accent-grid)' : 'var(--accent-danger)'} />}
        />
      </div>

      {/* 4. "WHY GRIDFLEX?" MOMENT - Executive Shortage Reduction Highlight */}
      <div className="section-title">
        <ZapIcon size={16} color="var(--accent-brand)" />
        Reliability Forecast &amp; GridFlex Optimization Impact
      </div>

      <Card
        title={shortage.peakBeforeKw > 0
          ? `${fmt.kw(shortage.peakBeforeKw)} shortage forecast at ${shortage.worst?.label ?? ''}`
          : 'No shortage forecast in horizon'}
        sub={shortage.peakBeforeKw > 0
          ? `Un-optimised draw breaches sanctioned import cap. After GridFlex optimization, residual gap is ${fmt.kw(shortage.peakAfterKw)}.`
          : `Local renewables and storage satisfy demand across next ${data.forecast.length} hours.`}
        right={<Badge severity={severity}>{severity.toUpperCase()}</Badge>}
      >
        {/* High-Impact Executive Reduction Callout */}
        <div className="reduction-hero-box">
          <div className="reduction-stat before">
            <div className="lbl">Without GridFlex</div>
            <div className="val">{fmt.kw(shortage.peakBeforeKw)}</div>
          </div>

          <div className="row" style={{ gap: 12 }}>
            <ArrowRightIcon size={24} color="var(--text-faint)" />
            <div className="reduction-badge">
              ↓ {percentageAvoided}% Avoided
            </div>
            <ArrowRightIcon size={24} color="var(--text-faint)" />
          </div>

          <div className="reduction-stat after">
            <div className="lbl">With GridFlex</div>
            <div className="val">{fmt.kw(shortage.peakAfterKw)}</div>
          </div>
        </div>

        <BeforeAfterChart baseline={data.baseline} optimised={data.optimised} height={280} />
        <Legend
          items={[
            { label: 'Do nothing (Un-optimised baseline)', color: '#ef4444' },
            { label: 'With GridFlex (Optimised dispatch)', color: '#22c55e' },
            { label: 'Sanctioned import cap', color: '#06b6d4' },
          ]}
        />
      </Card>

      {/* 5. 24-Hour Forecast & Recommended Actions */}
      <div className="section-title" style={{ marginTop: 32 }}>Next 24 Hours Horizon</div>
      <div className="asymmetric-2-1">
        <Card title="Forecast Supply &amp; Demand" sub="Shaded band shows forecast uncertainty; red region marks evening peak constraint">
          <SupplyDemandChart data={data.forecast} />
          <Legend
            items={[
              { label: 'Solar', color: '#f59e0b' },
              { label: 'Wind', color: '#38bdf8' },
              { label: 'Demand', color: '#f97316' },
            ]}
          />
        </Card>

        <Card title="Recommended Actions" sub={data.applied ? 'Applied to live schedule' : 'Proposed - review & commit'}>
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

      {/* 6. Hourly Energy Balance Dispatch Chart */}
      <div className="section-title" style={{ marginTop: 32 }}>Hourly Energy Balance Under Plan</div>
      <Card sub="Stacked bars show power source mix per hour; dashed line is the community import cap">
        <DispatchChart data={data.optimised} />
        <Legend
          items={[
            { label: 'Renewable', color: '#f59e0b' },
            { label: 'Battery', color: '#10b981' },
            { label: 'Grid', color: '#06b6d4' },
            { label: 'Demand', color: '#f97316' },
            { label: 'Import Cap', color: '#ef4444' },
          ]}
        />
      </Card>

      {/* 7. Savings & Impact Highlights */}
      <div className="section-title" style={{ marginTop: 32 }}>Measured Impact Against Baseline</div>
      <div className="grid g4">
        <Metric
          label="Peak Reduction"
          value={impact.savings.peakReductionPct.toFixed(1)}
          unit="%"
          foot={`${fmt.kw(impact.savings.peakReductionKw)} off daily peak`}
          tone="var(--accent-brand)"
        />
        <Metric
          label="Cost Savings"
          value={fmt.inr(impact.savings.costInr)}
          foot={`${impact.savings.costPct.toFixed(1)}% energy bill reduction`}
          tone="var(--accent-success)"
        />
        <Metric
          label="CO₂ Avoided"
          value={impact.savings.co2AvoidedKg.toFixed(0)}
          unit="kg"
          foot={`${fmt.kwh(impact.savings.gridEnergyAvoidedKwh)} less grid energy`}
          tone="var(--accent-battery)"
        />
        <Metric
          label="Shortage Cleared"
          value={impact.savings.shortageClearedKwh.toFixed(0)}
          unit="kWh"
          foot={`Renewable utilisation ${fmt.pct(data.cases[2].renewableUtilisationPct)}`}
          tone={TONE.normal}
        />
      </div>
    </>
  );
}
