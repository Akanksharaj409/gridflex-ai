import { api } from '../api';
import { useEndpoint } from '../state';
import { Badge, Card, Loading, Metric, StatRow, fmt } from '../components/ui';
import { DispatchChart } from '../components/charts';

export default function Discom() {
  const { data, loading } = useEndpoint(api.discom);

  if (loading && !data) return <Loading what="feeder view" />;
  if (!data) return null;

  const utilisation = (data.forecastPeakKw / data.firmCapacityKw) * 100;
  const utilisationAfter = (data.optimisedPeakKw / data.firmCapacityKw) * 100;

  return (
    <>
      <div className="page-head">
        <h2>DISCOM feeder view</h2>
        <p>
          What the utility sees: one feeder, its forecast peak, and how much of that peak the community can take off
          without the utility building anything. This is the demand-response capacity a distribution planner can
          actually dispatch.
        </p>
      </div>

      <div className="grid g4">
        <Metric label="Feeder" value={data.feederId} foot={`${data.community} · ${data.households} households`} tone="var(--grid)" />
        <Metric label="Current grid draw" value={data.currentLoadKw.toFixed(0)} unit="kW" foot={`Firm capacity ${fmt.kw(data.firmCapacityKw)}`} tone="var(--watch)" />
        <Metric
          label="Forecast peak"
          value={data.forecastPeakKw.toFixed(0)}
          unit="kW"
          foot={`${utilisation.toFixed(0)}% of firm capacity`}
          tone={utilisation > 95 ? 'var(--danger)' : utilisation > 80 ? 'var(--warn)' : 'var(--ok)'}
          fill={utilisation}
        />
        <Metric
          label="Peak with GridFlex"
          value={data.optimisedPeakKw.toFixed(0)}
          unit="kW"
          foot={`${utilisationAfter.toFixed(0)}% of firm capacity`}
          tone="var(--ok)"
          fill={utilisationAfter}
        />
      </div>

      <div className="section-title">Feeder status</div>
      <div className="grid g-1-2">
        <Card
          title="Risk assessment"
          right={<Badge severity={data.peakRisk === 'normal' ? 'normal' : data.peakRisk}>{data.peakRisk}</Badge>}
        >
          <StatRow k="Sanctioned load" v={fmt.kw(data.sanctionedLoadKw)} />
          <StatRow k="Peak-window cap" v={fmt.kw(data.peakWindowCapKw)} />
          <StatRow k="Firm feeder capacity" v={fmt.kw(data.firmCapacityKw)} />
          <StatRow k="Demand response available" v={fmt.kw(data.demandResponsePotentialKw)} />
          <StatRow k="Community storage available" v={fmt.kwh(data.batteryAvailableKwh)} />
          <StatRow k="Residual support requested" v={data.residualRequestKw > 0 ? fmt.kw(data.residualRequestKw) : 'None'} />
          <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: '14px 0 0' }}>
            <b style={{ color: 'var(--text)' }}>Recommended:</b> {data.recommendedAction}
          </p>
        </Card>

        <Card title="Feeder load under the optimised plan" sub="Stacked by source, against the import cap the community is held to">
          <DispatchChart
            data={data.hours.map((h) => ({
              ...h,
              label: h.label,
              renewableKw: h.renewableKw,
              batteryDischargeKw: h.batteryDischargeKw,
              gridImportKw: h.gridImportKw,
              demandKw: h.demandKw,
              capKw: h.capKw,
            }))}
            height={280}
          />
        </Card>
      </div>

      <div className="section-title">Constrained hours</div>
      <Card className="pad-0">
        <table>
          <thead>
            <tr>
              <th>Hour</th>
              <th className="num">Demand</th>
              <th className="num">Renewable</th>
              <th className="num">Battery</th>
              <th className="num">Grid import</th>
              <th className="num">Cap</th>
              <th className="num">Headroom</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.hours.map((h) => (
              <tr key={h.step}>
                <td className="mono">{h.label}</td>
                <td className="num">{h.demandKw.toFixed(0)}</td>
                <td className="num">{h.renewableKw.toFixed(0)}</td>
                <td className="num">{h.batteryDischargeKw > 0 ? h.batteryDischargeKw.toFixed(0) : '—'}</td>
                <td className="num">{h.gridImportKw.toFixed(0)}</td>
                <td className="num faint">{h.capKw}</td>
                <td className="num" style={{ color: h.headroomKw < 0 ? 'var(--danger)' : 'var(--text-dim)' }}>
                  {h.headroomKw.toFixed(0)}
                </td>
                <td><Badge severity={h.severity}>{h.severity}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {data.windows.length > 0 && (
        <>
          <div className="section-title">Demand-response windows worth calling</div>
          <div className="grid g3">
            {data.windows.map((w) => (
              <Card key={w.startHour} title={w.label} right={<Badge severity={w.severity}>{w.severity}</Badge>}>
                <StatRow k="Peak gap" v={fmt.kw(w.peakShortageKw)} />
                <StatRow k="Energy short" v={fmt.kwh(w.energyShortKwh)} />
                <StatRow k="Duration" v={`${w.durationHours}h`} />
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
