import { api } from '../api';
import { useEndpoint } from '../state';
import { Card, Loading, Metric, fmt } from '../components/ui';
import { DemandIcon, NeighbourhoodIcon, SolarIcon } from '../components/icons';

const TYPE_COLOR = {
  residential: 'var(--accent-demand)',
  commercial: 'var(--accent-solar)',
  ev: 'var(--accent-brand)',
  utility: 'var(--accent-grid)',
};

export default function Neighbourhood() {
  const { data, loading } = useEndpoint(api.neighbourhood);

  if (loading && !data) return <Loading what="neighbourhood data" />;
  if (!data) return null;

  const maxKw = Math.max(...data.units.map((u) => u.loadKw));
  const byType = data.units.reduce((acc, u) => {
    acc[u.type] = (acc[u.type] ?? 0) + u.loadKw;
    return acc;
  }, {});

  return (
    <>
      <div className="page-head">
        <h2>Neighbourhood Connections &amp; Telemetry</h2>
        <p>
          {data.households} households across eight metered connections at {data.label}. Load is disaggregated from
          the feeder reading using each connection&apos;s share and a diurnal tilt by customer type — commercial
          leans daytime, residential leans evening, EV leans night.
        </p>
      </div>

      <div className="grid g4">
        <Metric
          label="Total Demand"
          value={data.totalDemandKw.toFixed(0)}
          unit="kW"
          foot={`${data.households} households enrolled`}
          tone="var(--accent-demand)"
          icon={<DemandIcon size={18} color="var(--accent-demand)" />}
        />
        <Metric
          label="Local Generation"
          value={(data.solarKw + data.windKw).toFixed(0)}
          unit="kW"
          foot={`Solar ${fmt.kw(data.solarKw)} · wind ${fmt.kw(data.windKw)}`}
          tone="var(--accent-solar)"
          icon={<SolarIcon size={18} color="var(--accent-solar)" />}
        />
        <Metric
          label="Flexible Load"
          value={data.flexibleKw.toFixed(0)}
          unit="kW"
          foot={`${((data.flexibleKw / data.totalDemandKw) * 100).toFixed(0)}% of demand controllable`}
          tone="var(--accent-brand)"
          icon={<NeighbourhoodIcon size={18} color="var(--accent-brand)" />}
        />
        <Metric
          label="Inflexible Load"
          value={data.inflexibleKw.toFixed(0)}
          unit="kW"
          foot="Lighting, refrigeration, in-home appliances"
          tone="var(--accent-grid)"
        />
      </div>

      <div className="section-title">Metered Community Connections</div>
      <div className="grid g4">
        {data.units.map((u) => (
          <div className="flow-node" key={u.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="type" style={{ color: TYPE_COLOR[u.type], fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
                {u.type}
              </span>
              <span className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{u.loadKw.toFixed(1)} kW</span>
            </div>
            <div className="name" style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>{u.label}</div>
            <div className="bar-fill-track" style={{ marginTop: 10 }}>
              <div
                className="bar-fill-progress"
                style={{ width: `${(u.loadKw / maxKw) * 100}%`, background: TYPE_COLOR[u.type] }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="section-title">Demand Distribution By Customer Type</div>
      <Card>
        {Object.entries(byType)
          .sort((a, b) => b[1] - a[1])
          .map(([type, kw]) => (
            <div key={type} style={{ marginBottom: 16 }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ textTransform: 'capitalize', fontSize: 13.5, fontWeight: 600 }}>{type}</span>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>
                  {kw.toFixed(1)} kW
                  <span className="faint"> · {((kw / data.totalDemandKw) * 100).toFixed(0)}%</span>
                </span>
              </div>
              <div className="bar-fill-track" style={{ height: 8 }}>
                <div
                  className="bar-fill-progress"
                  style={{ width: `${(kw / data.totalDemandKw) * 100}%`, background: TYPE_COLOR[type] }}
                />
              </div>
            </div>
          ))}
      </Card>
    </>
  );
}
