import { api } from '../api';
import { useEndpoint, useGrid } from '../state';
import { Badge, Card, ICONS, Loading, Metric, fmt } from '../components/ui';
import { CurtailIcon, DemandResponseIcon, ShiftIcon, SparklesIcon } from '../components/icons';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const pad = (h) => `${String(h).padStart(2, '0')}:00`;

/** A 24-cell strip showing where a load sits now and where it is being moved to. */
function TimeStrip({ load }) {
  const from = load.currentStartHour;
  const to = load.recommendation.kind === 'shift' ? load.recommendation.toHour : null;
  const covers = (start, h) => start != null
    && Array.from({ length: load.durationHours ?? 1 }, (_, i) => (start + i) % 24).includes(h);

  return (
    <div className="time-strip">
      {HOURS.map((h) => {
        const isCurrent = load.kind === 'shiftable'
          ? covers(from, h)
          : load.activeHours?.includes(h);
        const isTarget = covers(to, h);
        let bg = '#142137';
        if (isCurrent && isTarget) bg = 'var(--accent-battery)';
        else if (isTarget) bg = 'var(--accent-battery)';
        else if (isCurrent) bg = to != null ? '#ef4444' : 'var(--accent-brand)';
        return (
          <div
            key={h}
            className="time-strip-cell"
            title={`${pad(h)}${isTarget ? ' — recommended' : isCurrent ? ' — current' : ''}`}
            style={{ background: bg }}
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
        <h2>Demand Response Optimization</h2>
        <p>
          Flexible load is the cheapest lever the community has. Each shiftable load is searched across every legal
          start hour by re-running the full battery dispatch and reading the real objective back — not by a
          tariff heuristic. Curtailment is applied last, only where shifting and storage fall short.
        </p>
      </div>

      <div className="grid g4">
        <Metric
          label="Loads Moved"
          value={data.shifts.length}
          foot={`${fmt.kwh(totalMovedKwh)} shifted out of peak`}
          tone="var(--accent-brand)"
          icon={<ShiftIcon size={18} color="var(--accent-brand)" />}
        />
        <Metric
          label="Curtailment"
          value={data.curtailments.length ? fmt.kw(totalReliefKw) : 'None'}
          foot={data.curtailments.length ? 'Comfort band respected' : 'Not needed under this plan'}
          tone="var(--accent-warn)"
          icon={<CurtailIcon size={18} color="var(--accent-warn)" />}
        />
        <Metric
          label="Flexible Capacity"
          value={fmt.kw(data.loads.reduce((a, l) => a + l.powerKw, 0))}
          foot={`${data.loads.length} controllable loads enrolled`}
          tone="var(--accent-grid)"
          icon={<DemandResponseIcon size={18} color="var(--accent-grid)" />}
        />
        <Metric
          label="Plan Status"
          value={sim?.planApplied ? 'Applied' : 'Proposed'}
          foot={sim?.planApplied ? 'Live schedule follows optimiser' : 'Review and apply to commit'}
          tone={sim?.planApplied ? 'var(--accent-battery)' : 'var(--text-dim)'}
        />
      </div>

      <div className="section-title">Enrolled Flexible Loads</div>
      <Card className="pad-0">
        <table>
          <thead>
            <tr>
              <th>Load</th>
              <th>Current</th>
              <th>Recommended</th>
              <th className="num">Power</th>
              <th style={{ width: '32%' }}>Day Distribution</th>
            </tr>
          </thead>
          <tbody>
            {data.loads.map((load) => (
              <tr key={load.id}>
                <td>
                  <div className="row">
                    <span style={{ fontSize: 18 }}>{ICONS[load.icon] ?? ''}</span>
                    <div>
                      <div style={{ fontWeight: 700 }}>{load.label}</div>
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

      <div className="row" style={{ marginTop: 20 }}>
        {sim?.planApplied ? (
          <button className="btn danger" onClick={revertPlan}>
            Revert to Un-optimised Schedule
          </button>
        ) : (
          <button
            className="btn primary"
            onClick={applyPlan}
            disabled={!data.shifts.length && !data.curtailments.length}
          >
            <SparklesIcon size={16} />
            <span>APPLY OPTIMISATION</span>
          </button>
        )}
        <span className="faint" style={{ fontSize: 12.5 }}>
          {data.shifts.length || data.curtailments.length
            ? `${data.shifts.length} shift(s) and ${data.curtailments.length} curtailment(s) will be committed to live schedule.`
            : 'Nothing worth changing under current forecast.'}
        </span>
      </div>

      <div className="section-title">Manual Load Control Override</div>
      <Card sub="Operators overrule the optimiser sometimes. Set a start hour directly and the plan re-solves around it.">
        <div className="grid g2">
          {shiftable.map((load) => (
            <div key={load.id} style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 8, border: '1px solid var(--line-soft)' }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{ICONS[load.icon]} {load.label}</span>
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
                style={{ width: '100%', accentColor: 'var(--accent-brand)', cursor: 'pointer' }}
              />
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
                <span className="faint" style={{ fontSize: 11 }}>earliest {pad(load.earliestHour)}</span>
                <span className="faint" style={{ fontSize: 11 }}>finish by {pad(load.latestFinishHour + 1)}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="section-title">Optimization Rationale</div>
      <Card>
        {data.shifts.length === 0 && data.curtailments.length === 0 && (
          <div className="muted">The current schedule is already the best one found — no move cleared the saving threshold.</div>
        )}
        {data.shifts.map((s) => (
          <div className="action" key={s.loadId}>
            <div className="pip"><ShiftIcon size={16} /></div>
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
            <div className="pip"><CurtailIcon size={16} /></div>
            <div>
              <div className="title">{c.label}: reduce {c.curtailPct}%</div>
              <div className="detail">
                {fmt.kw(c.reliefKw)} of relief, worst hour {c.worstHourLabel}. Capped at {c.powerKw} kW load&apos;s
                comfort band. {c.constraint}.
              </div>
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}
