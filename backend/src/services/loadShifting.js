import { FLEXIBLE_LOADS } from '../config/system.js';
import { importCapAt, tariffAt, hourLabel, round } from '../utils/calculations.js';

/**
 * INR-equivalent penalty per kW drawn above the import cap. High enough that
 * clearing a shortage always beats shaving a few rupees off the energy bill,
 * which is the right priority order for a reliability product.
 */
export const OVERLOAD_PENALTY = 40;

/** The objective the optimiser minimises: energy cost plus shortage penalty. */
export function objectiveOf(rows) {
  let costInr = 0;
  let shortageKwh = 0;
  for (const r of rows) {
    costInr += r.gridImportKw * tariffAt(r.hour);
    shortageKwh += Math.max(0, r.gridImportKw - importCapAt(r.hour));
  }
  return {
    objective: costInr + shortageKwh * OVERLOAD_PENALTY,
    costInr: round(costInr, 0),
    shortageKwh: round(shortageKwh, 1),
  };
}

/**
 * Every legal start hour for a shiftable load.
 *
 * `notBefore` matters more than it looks: the optimisation horizon wraps past
 * midnight, so without it the search happily "moves" the EV to 10:00 - meaning
 * 10:00 tomorrow - and presents it as a same-day action. Recommendations have
 * to be executable today or they are fiction.
 */
export function feasibleStarts(load, { notBefore = 0 } = {}) {
  const starts = [];
  for (let s = load.earliestHour; s + load.durationHours <= load.latestFinishHour + 1; s += 1) {
    if (s >= notBefore) starts.push(s);
  }
  return starts;
}

/**
 * Search each shiftable load's legal window for a better start hour.
 *
 * Rather than scoring candidate slots with a proxy (tariff, or "is there spare
 * solar right now"), this re-runs the full battery dispatch for each candidate
 * and reads the real objective back. A proxy gets this wrong in exactly the
 * case that matters: when the battery is already soaking up the midday surplus,
 * a curtailment-based signal reports no spare solar anywhere and the search
 * degenerates into "pick the earliest cheap hour" in every scenario.
 *
 * @param {object} schedule current { loadId: startHour }
 * @param {(schedule:object) => {objective:number}} evaluate full re-dispatch
 * @param {{minSaving?:number, currentHour?:number}} opts
 */
export function proposeShifts(schedule, evaluate, { minSaving = 40, currentHour = 0 } = {}) {
  const proposals = [];
  const base = evaluate(schedule);

  for (const load of FLEXIBLE_LOADS.filter((l) => l.kind === 'shiftable')) {
    const from = schedule?.[load.id] ?? load.defaultStartHour;
    // Already under way or finished today - nothing left to move.
    if (from < currentHour) continue;
    let best = { start: from, result: base };

    for (const start of feasibleStarts(load, { notBefore: currentHour })) {
      if (start === from) continue;
      const result = evaluate({ ...schedule, [load.id]: start });
      // Tie-break towards the least disruptive move: if two slots score the
      // same, do not drag someone's EV across the day for nothing.
      const disruption = Math.abs(start - load.defaultStartHour) * 0.01;
      if (result.objective + disruption < best.result.objective - 1e-6) {
        best = { start, result };
      }
    }

    const saving = base.objective - best.result.objective;
    if (best.start !== from && saving >= minSaving) {
      proposals.push({
        loadId: load.id,
        label: load.label,
        icon: load.icon,
        kind: 'shift',
        powerKw: load.powerKw,
        durationHours: load.durationHours,
        fromHour: from,
        toHour: best.start,
        fromLabel: `${hourLabel(from)}-${hourLabel(from + load.durationHours)}`,
        toLabel: `${hourLabel(best.start)}-${hourLabel(best.start + load.durationHours)}`,
        energyMovedKwh: round(load.powerKw * load.durationHours, 1),
        estimatedSaving: round(saving, 0),
        costSavingInr: round(base.costInr - best.result.costInr, 0),
        shortageClearedKwh: round(base.shortageKwh - best.result.shortageKwh, 1),
        constraint: load.note,
      });
    }
  }
  return proposals;
}

/**
 * Last resort: trim curtailable load in the hours still over the import cap.
 * One percentage per load, because that is how a real setpoint command works,
 * sized by the worst hour it can help with.
 */
export function proposeCurtailment(rows) {
  const proposals = [];
  for (const load of FLEXIBLE_LOADS.filter((l) => l.kind === 'curtailable')) {
    let neededKw = 0;
    let worstHour = null;
    for (const hour of load.activeHours) {
      const row = rows.find((r) => r.hour === hour);
      if (!row) continue;
      const exceedance = row.gridImportKw - importCapAt(hour);
      if (exceedance > neededKw) { neededKw = exceedance; worstHour = hour; }
    }
    if (neededKw <= 0.5) continue;
    const pct = Math.min(load.maxCurtailPct, Math.ceil((neededKw / load.powerKw) * 100));
    if (pct < 1) continue;
    proposals.push({
      loadId: load.id,
      label: load.label,
      icon: load.icon,
      kind: 'curtail',
      powerKw: load.powerKw,
      curtailPct: pct,
      reliefKw: round((pct / 100) * load.powerKw, 1),
      hours: load.activeHours,
      worstHour,
      worstHourLabel: worstHour == null ? null : hourLabel(worstHour),
      constraint: load.note,
    });
  }
  return proposals;
}
