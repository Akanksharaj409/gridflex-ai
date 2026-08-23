import { api } from '../api';
import { useEndpoint, useGrid } from '../state';
import { Badge, Card, ICONS, Loading, Metric, fmt } from '../components/ui';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const pad = (h) => `${String(h).padStart(2, '0')}:00`;

/** A 24-cell strip showing where a load sits now and where it is being moved to. */
function TimeStrip({ load }) {
  const from = load.currentStartHour;
  const to = load.recommendation.kind === 'shift' ? load.recommendation.toHour : null;
  const covers = (start, h) => start != null
    && Array.from({ length: load.durationHours ?? 1 }, (_, i) => (start + i) % 24).includes(h);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 2 }}>
      {HOURS.map((h) => {
        const isCurrent = load.kind === 'shiftable'
          ? covers(from, h)
          : load.activeHours?.includes(h);
        const isTarget = covers(to, h);
        let bg = '#17222c';
        if (isCurrent && isTarget) bg = 'var(--ok)';
        else if (isTarget) bg = 'var(--ok)';
        else if (isCurrent) bg = to != null ? '#5c2429' : 'var(--watch)';
        return (
          <div
            key={h}
            title={`${pad(h)}${isTarget ? ' — recommended' : isCurrent ? ' — current' : ''}`}
            style={{ height: 16, borderRadius: 2, background: bg }}
          />
        );
      })}
    </div>
  );
}

export default function DemandResponse() {
  const { sim, applyPlan, revertPlan, shiftLoad } = useGrid();
  const { data, loading } = useEndpoint(api.recommendations);

  if (loading && !data) return <Loading what="demand response plan" />;
  if (!data) return null;

  const shiftable = data.loads.filter((l) => l.kind === 'shiftable');
  const totalMovedKwh = data.shifts.reduce((a, s) => a + s.energyMovedKwh, 0);
  const totalReliefKw = data.curtailments.reduce((a, c) => a + c.reliefKw, 0);

  return (
    <>
      <div className="page-head">
        <h2>Demand response</h2>
        <p>
          Flexible load is the cheapest lever the community has. Each shiftable load is searched across every legal
          start hour by re-running the full battery dispatch and reading the real objective back — not by a
          tariff heuristic. Curtailment is applied last, only where shifting and storage fall short.
        </p>
      </div>

      <div className="grid g4">
        <Metric label="Loads moved" value={data.shifts.length} foot={`${fmt.kwh(totalMovedKwh)} shifted out of the peak`} tone="var(--watch)" />
        <Metric label="Curtailment" value={data.curtailments.length ? fmt.kw(totalReliefKw) : 'None'} foot={data.curtailments.length ? 'Comfort band respected' : 'Not needed under this plan'} tone="var(--warn)" />
        <Metric label="Flexible capacity" value={fmt.kw(data.loads.reduce((a, l) => a + l.powerKw, 0))} foot={`${data.loads.length} controllable loads enrolled`} tone="var(--grid)" />
        <Metric
          label="Plan status"
          value={sim?.planApplied ? 'Applied' : 'Proposed'}
          foot={sim?.planApplied ? 'Live schedule follows the optimiser' : 'Review and apply to commit'}
          tone={sim?.planApplied ? 'var(--ok)' : 'var(--text-dim)'}
        />
      </div>

      <div className="section-title">Flexible loads</div>
      <Card className="pad-0">
        <table>
          <thead>
            <tr>
              <th>Load</th>
              <th>Current</th>
              <th>Recommended</th>
              <th className="num">Power</th>
              <th style={{ width: '32%' }}>Day</th>
            </tr>
          </thead>
          <tbody>
            {data.loads.map((load) => (
              <tr key={load.id}>
                <td>
                  <div className="row">
                    <span>{ICONS[load.icon] ?? ''}</span>
                    <div>
                      <div style={{ fontWeight: 550 }}>{load.label}</div>
                      <div className="faint" style={{ fontSize: 11.5 }}>{load.note}</div>
                    </div>
                  </div>
                </td>
                <td className="mono">{load.currentLabel}</td>
                <td>
                  {load.recommendation.kind === 'shift' && (
                    <Badge severity="watch">{load.recommendation.label}</Badge>
                  )}
                  {load.recommendation.kind === 'curtail' && (
                    <Badge severity="warning">{load.recommendation.label}</Badge>
                  )}
                  {load.recommendation.kind === 'none' && <span className="faint">No change needed</span>}
                </td>
                <td className="num">{load.powerKw} kW</td>
                <td><TimeStrip load={load} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="row" style={{ marginTop: 16 }}>
        {sim?.planApplied
          ? <button className="btn danger" onClick={revertPlan}>Revert to un-optimised schedule</button>
          : (
            <button className="btn primary" onClick={applyPlan} disabled={!data.shifts.length && !data.curtailments.length}>
              Apply optimisation
            </button>
          )}
        <span className="faint" style={{ fontSize: 12 }}>
          {data.shifts.length || data.curtailments.length
            ? `${data.shifts.length} shift(s) and ${data.curtailments.length} curtailment(s) will be committed to the live schedule.`
            : 'Nothing worth changing under the current forecast.'}
        </span>
      </div>

      <div className="section-title">Manual override</div>
      <Card sub="Operators overrule the optimiser sometimes. Set a start hour directly and the plan re-solves around it.">
        <div className="grid g2">
          {shiftable.map((load) => (
            <div key={load.id}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13 }}>{ICONS[load.icon]} {load.label}</span>
                <span className="mono faint" style={{ fontSize: 12 }}>
                  {pad(load.currentStartHour)}–{pad((load.currentStartHour + load.durationHours) % 24)}
                </span>
              </div>
              <input
                type="range"
                min={load.earliestHour}
                max={load.latestFinishHour - load.durationHours + 1}
                value={load.currentStartHour}
                onChange={(e) => shiftLoad(load.id, Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--watch)' }}
              />
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="faint" style={{ fontSize: 11 }}>earliest {pad(load.earliestHour)}</span>
                <span className="faint" style={{ fontSize: 11 }}>finish by {pad(load.latestFinishHour + 1)}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="section-title">Why these moves</div>
      <Card>
        {data.shifts.length === 0 && data.curtailments.length === 0 && (
          <div className="muted">The current schedule is already the best one found — no move cleared the saving threshold.</div>
        )}
        {data.shifts.map((s) => (
          <div className="action" key={s.loadId}>
            <div className="pip">{ICONS.shift}</div>
            <div>
              <div className="title">{s.label}: {s.fromLabel} → {s.toLabel}</div>
              <div className="detail">
                {fmt.kwh(s.energyMovedKwh)} moved. Worth {fmt.inr(s.costSavingInr)} in energy cost
                {s.shortageClearedKwh > 0 && `, and clears ${fmt.kwh(s.shortageClearedKwh)} of shortage`}.
                Constraint respected: {s.constraint.toLowerCase()}.
              </div>
            </div>
          </div>
        ))}
        {data.curtailments.map((c) => (
          <div className="action" key={c.loadId}>
            <div className="pip">{ICONS.curtail}</div>
            <div>
              <div className="title">{c.label}: reduce {c.curtailPct}%</div>
              <div className="detail">
                {fmt.kw(c.reliefKw)} of relief, worst hour {c.worstHourLabel}. Capped at the {c.powerKw} kW load&apos;s
                comfort band. {c.constraint}.
              </div>
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}
