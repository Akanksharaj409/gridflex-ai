import { api } from '../api';
import { useEndpoint } from '../state';
import { Card, Loading, Metric, fmt } from '../components/ui';

const TYPE_COLOR = {
  residential: 'var(--demand)',
  commercial: 'var(--solar)',
  ev: 'var(--watch)',
  utility: 'var(--grid)',
};

export default function Neighbourhood() {
  const { data, loading } = useEndpoint(api.neighbourhood);

  if (loading && !data) return <Loading what="neighbourhood" />;
  if (!data) return null;

  const maxKw = Math.max(...data.units.map((u) => u.loadKw));
  const byType = data.units.reduce((acc, u) => {
    acc[u.type] = (acc[u.type] ?? 0) + u.loadKw;
    return acc;
  }, {});

  return (
    <>
      <div className="page-head">
        <h2>Neighbourhood</h2>
        <p>
          {data.households} households across eight metered connections at {data.label}. Load is disaggregated from
          the feeder reading using each connection&apos;s share and a diurnal tilt by customer type — commercial
          leans daytime, residential leans evening, EV leans night.
        </p>
      </div>

      <div className="grid g4">
        <Metric label="Total demand" value={data.totalDemandKw.toFixed(0)} unit="kW" foot={`${data.households} households`} tone="var(--demand)" />
        <Metric label="Local generation" value={(data.solarKw + data.windKw).toFixed(0)} unit="kW" foot={`Solar ${fmt.kw(data.solarKw)} · wind ${fmt.kw(data.windKw)}`} tone="var(--solar)" />
        <Metric label="Flexible load" value={data.flexibleKw.toFixed(0)} unit="kW" foot={`${((data.flexibleKw / data.totalDemandKw) * 100).toFixed(0)}% of demand is controllable`} tone="var(--watch)" />
        <Metric label="Inflexible load" value={data.inflexibleKw.toFixed(0)} unit="kW" foot="Lighting, refrigeration, in-home appliances" tone="var(--grid)" />
      </div>

      <div className="section-title">Metered connections</div>
      <div className="grid g4">
        {data.units.map((u) => (
          <div className="unit" key={u.id}>
            <div className="type" style={{ color: TYPE_COLOR[u.type] }}>{u.type}</div>
            <div className="name">{u.label}</div>
            <div className="kw">{u.loadKw.toFixed(1)} <span className="faint" style={{ fontSize: 13 }}>kW</span></div>
            <div className="meter">
              <span style={{ width: `${(u.loadKw / maxKw) * 100}%`, background: TYPE_COLOR[u.type] }} />
            </div>
          </div>
        ))}
      </div>

      <div className="section-title">By customer type</div>
      <Card>
        {Object.entries(byType)
          .sort((a, b) => b[1] - a[1])
          .map(([type, kw]) => (
            <div key={type} style={{ marginBottom: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ textTransform: 'capitalize', fontSize: 13 }}>{type}</span>
                <span className="mono" style={{ fontSize: 13 }}>
                  {kw.toFixed(1)} kW
                  <span className="faint"> · {((kw / data.totalDemandKw) * 100).toFixed(0)}%</span>
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
                <span style={{
                  display: 'block',
                  height: '100%',
                  width: `${(kw / data.totalDemandKw) * 100}%`,
                  background: TYPE_COLOR[type],
                }}
                />
              </div>
            </div>
          ))}
      </Card>
    </>
  );
}
