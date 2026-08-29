import { api } from '../api';
import { useEndpoint } from '../state';
import { Card, Legend, Loading, Metric, StatRow, fmt } from '../components/ui';
import { DemandIcon, SolarIcon } from '../components/icons';
import { SupplyDemandChart } from '../components/charts';

export default function Forecast() {
  const { data, loading } = useEndpoint(api.forecast);
  const { data: shortage } = useEndpoint(api.shortage);

  if (loading && !data) return <Loading what="energy forecast" />;
  if (!data) return null;

  const surplus = data.rows.filter((r) => r.netKw > 0);
  const deficit = data.rows.filter((r) => r.netKw < 0);
  const worstDeficit = deficit.reduce((w, r) => (r.netKw < (w?.netKw ?? 0) ? r : w), null);
  const bestSurplus = surplus.reduce((b, r) => (r.netKw > (b?.netKw ?? 0) ? r : b), null);

  return (
    <>
      <div className="page-head">
        <h2>Energy forecast</h2>
        <p>
          Renewable generation and demand for the next {data.rows.length} hours. Demand is predicted from a
          weather-normalised hour-of-day baseline learned from 14 days of metered history; solar from a clear-sky
          model attenuated by forecast cloud cover.
        </p>
      </div>

      <div className="grid g4">
        <Metric
          label="Peak solar"
          value={Math.max(...data.rows.map((r) => r.predictedSolarKw)).toFixed(0)}
          unit="kW"
          foot={`at ${data.rows.reduce((a, b) => (b.predictedSolarKw > a.predictedSolarKw ? b : a)).label}`}
          tone="var(--solar)"
          icon={<SolarIcon size={18} color="var(--solar)" />}
        />
        <Metric
          label="Peak demand"
          value={Math.max(...data.rows.map((r) => r.predictedDemandKw)).toFixed(0)}
          unit="kW"
          foot={`at ${data.rows.reduce((a, b) => (b.predictedDemandKw > a.predictedDemandKw ? b : a)).label}`}
          tone="var(--demand)"
          icon={<DemandIcon size={18} color="var(--demand)" />}
        />
        <Metric
          label="Surplus window"
          value={bestSurplus ? `+${bestSurplus.netKw.toFixed(0)}` : '0'}
          unit="kW"
          foot={bestSurplus ? `peaks at ${bestSurplus.label} · ${surplus.length}h of surplus` : 'no surplus in horizon'}
          tone="var(--ok)"
        />
        <Metric
          label="Deficit window"
          value={worstDeficit ? worstDeficit.netKw.toFixed(0) : '0'}
          unit="kW"
          foot={worstDeficit ? `worst at ${worstDeficit.label} · ${deficit.length}h of deficit` : 'fully covered'}
          tone="var(--danger)"
        />
      </div>

      <div className="section-title">Generation Against Demand</div>
      <Card sub="Shaded band around demand is forecast uncertainty, widening with lead time">
        <SupplyDemandChart data={data.rows} height={340} />
        <Legend
          items={[
            { label: 'Solar', color: '#f59e0b' },
            { label: 'Wind', color: '#38bdf8' },
            { label: 'Demand', color: '#f97316' },
          ]}
        />
      </Card>

      <div className="section-title">Forecast Detail Table</div>
      <div className="grid g-2-1">
        <Card className="pad-0">
          <div style={{ maxHeight: 460, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Hour</th>
                  <th className="num">Solar</th>
                  <th className="num">Wind</th>
                  <th className="num">Demand</th>
                  <th className="num">Net</th>
                  <th className="num">Temp</th>
                  <th className="num">Cloud</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.step}>
                    <td className="mono">{r.label}{r.leadHours === 0 && <span className="faint"> now</span>}</td>
                    <td className="num">{r.predictedSolarKw.toFixed(0)}</td>
                    <td className="num">{r.predictedWindKw.toFixed(0)}</td>
                    <td className="num">{r.predictedDemandKw.toFixed(0)}</td>
                    <td className="num" style={{ color: r.netKw >= 0 ? 'var(--ok)' : 'var(--danger)', fontWeight: 600 }}>
                      {r.netKw > 0 ? '+' : ''}{r.netKw.toFixed(0)}
                    </td>
                    <td className="num">{r.tempC.toFixed(1)}°</td>
                    <td className="num">{(r.cloudCover * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid" style={{ alignContent: 'start' }}>
          <Card title="Model skill" sub="Backtested on recent day of history, held out of training">
            <StatRow k="Demand MAPE" v={fmt.pct(data.accuracy.demandMapePct)} />
            <StatRow k="Solar MAPE (daylight)" v={fmt.pct(data.accuracy.solarMapePct)} />
            <StatRow k="Backtest day" v={`D${data.accuracy.backtestDay}`} />
            <p className="faint" style={{ fontSize: 12, marginTop: 14, marginBottom: 0, lineHeight: 1.45 }}>
              {data.accuracy.note} {data.accuracy.method}.
            </p>
          </Card>

          {shortage && (
            <Card title="Predicted shortage windows" sub="Hours where forecast grid import exceeds cap">
              {shortage.before.windows.length === 0 && <div className="muted">None in this horizon.</div>}
              {shortage.before.windows.map((w) => (
                <StatRow key={w.startHour} k={w.label} v={`${w.peakShortageKw} kW · ${w.severity}`} />
              ))}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
