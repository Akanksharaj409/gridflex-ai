import { api } from '../api';
import { useEndpoint } from '../state';
import { Badge, Card, Loading, fmt } from '../components/ui';
import { ShortageChart } from '../components/charts';

export default function Alerts() {
  const { data, loading } = useEndpoint(api.alerts);
  const { data: shortage } = useEndpoint(api.shortage);

  if (loading && !data) return <Loading what="alerts" />;
  if (!data) return null;

  const open = data.alerts.filter((a) => !a.resolved);
  const closed = data.alerts.filter((a) => a.resolved);

  return (
    <>
      <div className="page-head">
        <h2>Alerts</h2>
        <p>
          Raised from the forecast, not from what has already gone wrong. An alert marked resolved is one the
          optimisation plan closes — the underlying condition is still forecast, the response covers it.
        </p>
      </div>

      {shortage && (
        <>
          <div className="section-title">Shortage by hour</div>
          <Card sub="Red is the gap without action, green is what remains after the plan runs">
            <ShortageChart before={shortage.before.hours} after={shortage.after.hours} />
            <div className="row wrap" style={{ marginTop: 10, gap: 20, fontSize: 12 }}>
              <span className="muted">Peak gap <b className="mono">{fmt.kw(shortage.before.peakShortageKw)}</b></span>
              <span className="muted">After plan <b className="mono">{fmt.kw(shortage.after.peakShortageKw)}</b></span>
              <span className="muted">Energy cleared <b className="mono">{fmt.kwh(shortage.cleared.energyKwh)}</b></span>
            </div>
          </Card>
        </>
      )}

      <div className="section-title">Open ({open.length})</div>
      <div className="grid">
        {open.length === 0 && <Card><span className="muted">Nothing open. Every forecast condition is covered by the current plan.</span></Card>}
        {open.map((a) => (
          <div className={`alert ${a.severity}`} key={a.id}>
            <div className="rail" />
            <div style={{ flex: 1 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong style={{ fontSize: 13.5 }}>{a.title}</strong>
                <Badge severity={a.severity}>{a.severity}</Badge>
              </div>
              <div className="body">{a.body}</div>
            </div>
          </div>
        ))}
      </div>

      {closed.length > 0 && (
        <>
          <div className="section-title">Covered by the plan ({closed.length})</div>
          <div className="grid">
            {closed.map((a) => (
              <div className={`alert ${a.severity}`} key={a.id} style={{ opacity: 0.72 }}>
                <div className="rail" />
                <div style={{ flex: 1 }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <strong style={{ fontSize: 13.5 }}>{a.title}</strong>
                    <Badge severity="normal">covered</Badge>
                  </div>
                  <div className="body">{a.body}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-title">Operator log</div>
      <Card className="pad-0">
        {data.log.length === 0
          ? <div style={{ padding: 16 }} className="muted">No operator actions yet this session.</div>
          : (
            <table>
              <thead><tr><th>Time</th><th>Action</th><th>Detail</th></tr></thead>
              <tbody>
                {data.log.map((l) => (
                  <tr key={l.at + l.kind}>
                    <td className="mono faint">{new Date(l.at).toLocaleTimeString()}</td>
                    <td><Badge severity="plain">{l.kind}</Badge></td>
                    <td>{l.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </Card>
    </>
  );
}
