import { FLEXIBLE_LOADS } from '../config/system.js';
import { importCapAt, tariffAt, hourLabel, clamp, round } from '../utils/calculations.js';

const OVERLOAD_PENALTY = 40; // INR-equivalent per kW over the import cap

/**
 * Cost of parking `powerKw` of load at `hour`, given the current dispatch.
 * Renewable energy that would otherwise be curtailed is free; everything else
 * pays the tariff, plus a steep penalty for pushing past the import cap.
 */
function placementCost(hour, powerKw, row) {
  const free = clamp((row?.curtailedRenewableKw ?? 0) / powerKw, 0, 1);
  const billable = powerKw * (1 - free);
  const exceedance = Math.max(0, (row?.gridImportKw ?? 0) + billable - importCapAt(hour));
  const alreadyOver = Math.max(0, (row?.gridImportKw ?? 0) - importCapAt(hour));
  return billable * tariffAt(hour) + (exceedance - alreadyOver) * OVERLOAD_PENALTY;
}

const rowAt = (rows, hour) => rows.find((r) => r.hour === hour);

/** Every legal start hour for a shiftable load. */
export function feasibleStarts(load) {
  const starts = [];
  for (let s = load.earliestHour; s + load.durationHours <= load.latestFinishHour + 1; s += 1) {
    starts.push(s);
  }
  return starts;
}

function scoreStart(load, start, rows) {
  let score = 0;
  for (let i = 0; i < load.durationHours; i += 1) {
    const hour = (start + i) % 24;
    score += placementCost(hour, load.powerKw, rowAt(rows, hour));
  }
  return score;
}

/**
 * Propose a better start hour for each shiftable load against the given
 * dispatch. Returns proposals only where the saving clears a threshold - a
 * recommendation that moves someone's EV charging by an hour to save 4 rupees
 * is noise, and operators stop trusting the system that emits it.
 */
export function proposeShifts(rows, currentSchedule, { minSaving = 25 } = {}) {
  const proposals = [];
  const loads = FLEXIBLE_LOADS.filter((l) => l.kind === 'shiftable')
    .sort((a, b) => b.powerKw * b.durationHours - a.powerKw * a.durationHours);

  for (const load of loads) {
    const from = currentSchedule?.[load.id] ?? load.defaultStartHour;
    const currentScore = scoreStart(load, from, rows);
    let best = { start: from, score: currentScore };
    for (const s of feasibleStarts(load)) {
      const score = scoreStart(load, s, rows);
      if (score < best.score - 0.001) best = { start: s, score };
    }
    const saving = currentScore - best.score;
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
        constraint: load.note,
      });
    }
  }
  return proposals;
}

/**
 * Last resort: trim curtailable load in the hours still over the import cap.
 * One percentage per load (that is how a real setpoint command works), sized
 * by the worst hour it can help with.
 */
export function proposeCurtailment(rows) {
  const proposals = [];
  for (const load of FLEXIBLE_LOADS.filter((l) => l.kind === 'curtailable')) {
    let neededKw = 0;
    let worstHour = null;
    for (const hour of load.activeHours) {
      const row = rowAt(rows, hour);
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
